import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ServiceStatusRepository,
  ServiceStatusUpdate,
} from '@/repositories/service-status.repository';

// Mock Decimal class
class MockDecimal {
  private value: number;

  constructor(value: number | string) {
    this.value = typeof value === 'string' ? parseFloat(value) : value;
  }

  toNumber(): number {
    return this.value;
  }

  toString(): string {
    return this.value.toString();
  }
}

// Mock Prisma client
const mockPrismaClient = {
  serviceStatus: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  $disconnect: vi.fn(),
  $transaction: vi.fn((callback) => callback(mockPrismaClient)),
};

// Mock the database helper
vi.mock('../../helpers/database', () => ({
  getTestPrismaClient: () => mockPrismaClient,
  cleanDatabase: vi.fn().mockResolvedValue(undefined),
  disconnectDatabase: vi.fn().mockResolvedValue(undefined),
}));

// Mock Prisma client and Decimal
vi.mock('@prisma/client', () => ({
  Decimal: MockDecimal,
  PrismaClient: vi.fn().mockImplementation(() => mockPrismaClient),
}));

describe('ServiceStatusRepository Integration Tests', () => {
  let repository: ServiceStatusRepository;

  beforeEach(() => {
    repository = new ServiceStatusRepository(mockPrismaClient as any);

    // Reset all mocks
    vi.resetAllMocks();

    // Setup basic upsert mock
    mockPrismaClient.serviceStatus.upsert.mockImplementation(({ where, create, update }) => {
      const data = create || update;
      return Promise.resolve({
        id: Math.floor(Math.random() * 1000),
        serviceName: where.serviceName,
        status: data?.status || 'healthy',
        responseTimeMs: data?.responseTimeMs || null,
        uptimePercentage: data?.uptimePercentage ? new MockDecimal(data.uptimePercentage) : null,
        lastCheckAt: data?.lastCheckAt || new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // Setup basic findUnique mock
    mockPrismaClient.serviceStatus.findUnique.mockImplementation(({ where }) => {
      if (where.serviceName === 'plex') {
        return Promise.resolve({
          id: 1,
          serviceName: 'plex',
          status: 'healthy',
          responseTimeMs: 120,
          uptimePercentage: new MockDecimal(99.5),
          lastCheckAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      return Promise.resolve(null);
    });

    // Setup basic findMany mock
    mockPrismaClient.serviceStatus.findMany.mockResolvedValue([
      { serviceName: 'overseerr', status: 'unhealthy' },
      { serviceName: 'plex', status: 'healthy' },
      { serviceName: 'uptime-kuma', status: 'healthy' },
    ]);

    // Setup aggregate mock
    mockPrismaClient.serviceStatus.aggregate.mockResolvedValue({
      _avg: { responseTimeMs: 200 },
    });
  });

  describe('upsert', () => {
    it('should create new service status when it does not exist', async () => {
      const data: ServiceStatusUpdate = {
        status: 'healthy',
        responseTimeMs: 150,
        uptimePercentage: 99.5,
      };

      const result = await repository.upsert('plex', data);

      expect(result).toMatchObject({
        id: expect.any(Number),
        serviceName: 'plex',
        status: 'healthy',
        responseTimeMs: 150,
        lastCheckAt: expect.any(Date),
      });

      // Check decimal precision
      expect(result.uptimePercentage?.toNumber()).toBe(99.5);
      expect(mockPrismaClient.serviceStatus.upsert).toHaveBeenCalledWith({
        where: { serviceName: 'plex' },
        update: expect.objectContaining(data),
        create: expect.objectContaining({
          serviceName: 'plex',
          ...data,
        }),
      });
    });

    it('should update existing service status', async () => {
      const updatedData: ServiceStatusUpdate = {
        status: 'unhealthy',
        responseTimeMs: 2000,
        uptimePercentage: 95.0,
      };

      const result = await repository.upsert('plex', updatedData);

      expect(result.status).toBe('unhealthy');
      expect(result.responseTimeMs).toBe(2000);
      expect(result.uptimePercentage?.toNumber()).toBe(95.0);
    });

    it('should set lastCheckAt to current time when not provided', async () => {
      const beforeCreate = new Date();

      const result = await repository.upsert('plex', {
        status: 'healthy',
        responseTimeMs: 150,
      });

      expect(result.lastCheckAt).toBeInstanceOf(Date);
      expect(result.lastCheckAt!.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    });

    it('should use provided lastCheckAt when specified', async () => {
      const customTime = new Date('2023-01-01T12:00:00Z');

      mockPrismaClient.serviceStatus.upsert.mockResolvedValueOnce({
        id: 1,
        serviceName: 'plex',
        status: 'healthy',
        lastCheckAt: customTime,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await repository.upsert('plex', {
        status: 'healthy',
        lastCheckAt: customTime,
      });

      expect(result.lastCheckAt!.getTime()).toBe(customTime.getTime());
    });
  });

  describe('findByName', () => {
    it('should find service status by name', async () => {
      const result = await repository.findByName('plex');

      expect(result).toMatchObject({
        serviceName: 'plex',
        status: 'healthy',
        responseTimeMs: 120,
      });
      expect(mockPrismaClient.serviceStatus.findUnique).toHaveBeenCalledWith({
        where: { serviceName: 'plex' },
      });
    });

    it('should return null for non-existent service', async () => {
      mockPrismaClient.serviceStatus.findUnique.mockResolvedValueOnce(null);

      const result = await repository.findByName('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all service statuses ordered by name', async () => {
      const result = await repository.findAll();

      expect(result).toHaveLength(3);
      expect(result[0].serviceName).toBe('overseerr');
      expect(result[1].serviceName).toBe('plex');
      expect(result[2].serviceName).toBe('uptime-kuma');
      expect(mockPrismaClient.serviceStatus.findMany).toHaveBeenCalledWith({
        orderBy: { serviceName: 'asc' },
      });
    });

    it('should return empty array when no services exist', async () => {
      mockPrismaClient.serviceStatus.findMany.mockResolvedValueOnce([]);

      const result = await repository.findAll();
      expect(result).toHaveLength(0);
    });
  });

  describe('updateStatus', () => {
    it('should update status and response time', async () => {
      mockPrismaClient.serviceStatus.upsert.mockResolvedValueOnce({
        id: 1,
        serviceName: 'plex',
        status: 'healthy',
        responseTimeMs: 150,
        lastCheckAt: new Date(),
      });

      const result = await repository.updateStatus('plex', 'healthy', 150);

      expect(result.status).toBe('healthy');
      expect(result.responseTimeMs).toBe(150);
      expect(result.lastCheckAt).toBeInstanceOf(Date);
    });

    it('should work without response time', async () => {
      mockPrismaClient.serviceStatus.upsert.mockResolvedValueOnce({
        id: 1,
        serviceName: 'plex',
        status: 'unhealthy',
        responseTimeMs: null,
      });

      const result = await repository.updateStatus('plex', 'unhealthy');

      expect(result.status).toBe('unhealthy');
      expect(result.responseTimeMs).toBeNull();
    });
  });

  describe('updateUptimePercentage', () => {
    it('should update uptime percentage', async () => {
      mockPrismaClient.serviceStatus.upsert.mockResolvedValueOnce({
        id: 1,
        serviceName: 'plex',
        uptimePercentage: new MockDecimal(98.75),
      });

      const result = await repository.updateUptimePercentage('plex', 98.75);

      expect(result.uptimePercentage?.toNumber()).toBe(98.75);
    });

    it('should handle high precision decimals', async () => {
      mockPrismaClient.serviceStatus.upsert.mockResolvedValueOnce({
        id: 1,
        serviceName: 'plex',
        uptimePercentage: new MockDecimal(99.99),
      });

      const result = await repository.updateUptimePercentage('plex', 99.99);

      expect(result.uptimePercentage?.toNumber()).toBe(99.99);
    });

    it('should handle edge cases', async () => {
      mockPrismaClient.serviceStatus.upsert
        .mockResolvedValueOnce({
          id: 1,
          serviceName: 'plex',
          uptimePercentage: new MockDecimal(0),
        })
        .mockResolvedValueOnce({
          id: 2,
          serviceName: 'overseerr',
          uptimePercentage: new MockDecimal(100),
        });

      const result1 = await repository.updateUptimePercentage('plex', 0);
      expect(result1.uptimePercentage?.toNumber()).toBe(0);

      const result2 = await repository.updateUptimePercentage('overseerr', 100);
      expect(result2.uptimePercentage?.toNumber()).toBe(100);
    });
  });

  describe('getHealthyServices', () => {
    it('should return only healthy services', async () => {
      mockPrismaClient.serviceStatus.findMany.mockResolvedValueOnce([
        { id: 1, serviceName: 'plex', status: 'healthy' },
        { id: 2, serviceName: 'uptime-kuma', status: 'healthy' },
      ]);

      const result = await repository.getHealthyServices();

      expect(result).toHaveLength(2);
      expect(result[0].serviceName).toBe('plex');
      expect(result[0].status).toBe('healthy');
      expect(result[1].serviceName).toBe('uptime-kuma');
      expect(result[1].status).toBe('healthy');
    });

    it('should return empty array when no healthy services', async () => {
      mockPrismaClient.serviceStatus.findMany.mockResolvedValueOnce([]);

      const result = await repository.getHealthyServices();
      expect(result).toHaveLength(0);
    });
  });

  describe('getUnhealthyServices', () => {
    it('should return unhealthy and null status services', async () => {
      mockPrismaClient.serviceStatus.findMany.mockResolvedValueOnce([
        { serviceName: 'overseerr', status: 'unhealthy' },
        { serviceName: 'sonarr', status: null },
        { serviceName: 'uptime-kuma', status: 'degraded' },
      ]);

      const result = await repository.getUnhealthyServices();

      expect(result).toHaveLength(3);
      const serviceNames = result.map((s) => s.serviceName).sort();
      expect(serviceNames).toEqual(['overseerr', 'sonarr', 'uptime-kuma']);
    });
  });

  describe('getServicesStalerThan', () => {
    it('should return services older than threshold', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      mockPrismaClient.serviceStatus.findMany.mockResolvedValueOnce([
        { serviceName: 'overseerr', lastCheckAt: oneHourAgo },
        { serviceName: 'sonarr', lastCheckAt: null },
        { serviceName: 'uptime-kuma', lastCheckAt: oneHourAgo },
      ]);

      const result = await repository.getServicesStalerThan(30); // 30 minutes

      expect(result).toHaveLength(3);
      const serviceNames = result.map((s) => s.serviceName).sort();
      expect(serviceNames).toEqual(['overseerr', 'sonarr', 'uptime-kuma']);
    });

    it('should return empty array when all services are fresh', async () => {
      mockPrismaClient.serviceStatus.findMany.mockResolvedValueOnce([]);

      const result = await repository.getServicesStalerThan(180); // 3 hours
      expect(result).toHaveLength(0);
    });
  });

  describe('clearStatus', () => {
    it('should clear status and response time but update lastCheckAt', async () => {
      mockPrismaClient.serviceStatus.upsert.mockResolvedValueOnce({
        id: 1,
        serviceName: 'plex',
        status: null,
        responseTimeMs: null,
        lastCheckAt: new Date(),
      });

      const result = await repository.clearStatus('plex');

      expect(result.status).toBeNull();
      expect(result.responseTimeMs).toBeNull();
      expect(result.lastCheckAt).toBeInstanceOf(Date);
    });

    it('should work for non-existent service', async () => {
      mockPrismaClient.serviceStatus.upsert.mockResolvedValueOnce({
        id: 1,
        serviceName: 'new-service',
        status: null,
        responseTimeMs: null,
        lastCheckAt: new Date(),
      });

      const result = await repository.clearStatus('new-service');

      expect(result.serviceName).toBe('new-service');
      expect(result.status).toBeNull();
    });
  });

  describe('getAverageResponseTime', () => {
    it('should calculate average response time', async () => {
      mockPrismaClient.serviceStatus.aggregate.mockResolvedValueOnce({
        _avg: { responseTimeMs: 200 },
      });

      const result = await repository.getAverageResponseTime('plex');
      expect(result).toBe(200);
    });

    it('should return null for non-existent service', async () => {
      mockPrismaClient.serviceStatus.aggregate.mockResolvedValueOnce({
        _avg: { responseTimeMs: null },
      });

      const result = await repository.getAverageResponseTime('non-existent');
      expect(result).toBeNull();
    });

    it('should handle service with null response times', async () => {
      mockPrismaClient.serviceStatus.aggregate.mockResolvedValueOnce({
        _avg: { responseTimeMs: null },
      });

      const result = await repository.getAverageResponseTime('test-service');
      expect(result).toBeNull();
    });
  });

  describe('real-world scenarios', () => {
    it('should handle service monitoring workflow', async () => {
      const serviceName = 'plex';

      // Mock sequence of operations
      mockPrismaClient.serviceStatus.upsert
        .mockResolvedValueOnce({
          // Initial unhealthy
          id: 1,
          serviceName,
          status: 'unhealthy',
          responseTimeMs: 5000,
        })
        .mockResolvedValueOnce({
          // Recovery
          id: 1,
          serviceName,
          status: 'healthy',
          responseTimeMs: 150,
        })
        .mockResolvedValueOnce({
          // Uptime update
          id: 1,
          serviceName,
          status: 'healthy',
          uptimePercentage: new MockDecimal(98.5),
        })
        .mockResolvedValueOnce({
          // Degraded
          id: 1,
          serviceName,
          status: 'degraded',
          responseTimeMs: 800,
        });

      mockPrismaClient.serviceStatus.findUnique
        .mockResolvedValueOnce({ status: 'unhealthy' })
        .mockResolvedValueOnce({ status: 'healthy', responseTimeMs: 150 })
        .mockResolvedValueOnce({ status: 'healthy', uptimePercentage: new MockDecimal(98.5) })
        .mockResolvedValueOnce({ status: 'degraded', responseTimeMs: 800 });

      // 1. Initial health check - service is down
      await repository.updateStatus(serviceName, 'unhealthy', 5000);
      let status = await repository.findByName(serviceName);
      expect(status?.status).toBe('unhealthy');

      // 2. Service recovers
      await repository.updateStatus(serviceName, 'healthy', 150);
      status = await repository.findByName(serviceName);
      expect(status?.status).toBe('healthy');
      expect(status?.responseTimeMs).toBe(150);

      // 3. Update uptime percentage
      await repository.updateUptimePercentage(serviceName, 98.5);
      status = await repository.findByName(serviceName);
      expect(status?.uptimePercentage?.toNumber()).toBe(98.5);

      // 4. Service becomes degraded
      await repository.updateStatus(serviceName, 'degraded', 800);
      status = await repository.findByName(serviceName);
      expect(status?.status).toBe('degraded');
      expect(status?.responseTimeMs).toBe(800);
    });

    it('should handle dashboard overview queries', async () => {
      // Mock findAll
      mockPrismaClient.serviceStatus.findMany
        .mockResolvedValueOnce([
          // findAll
          { serviceName: 'plex' },
          { serviceName: 'overseerr' },
          { serviceName: 'sonarr' },
          { serviceName: 'radarr' },
          { serviceName: 'uptime-kuma' },
        ])
        .mockResolvedValueOnce([
          // getHealthyServices
          { serviceName: 'plex', status: 'healthy' },
          { serviceName: 'overseerr', status: 'healthy' },
        ])
        .mockResolvedValueOnce([
          // getUnhealthyServices
          { serviceName: 'sonarr', status: 'degraded' },
          { serviceName: 'radarr', status: 'unhealthy' },
        ])
        .mockResolvedValueOnce([
          // getServicesStalerThan
          { serviceName: 'uptime-kuma' },
        ]);

      // Dashboard queries
      const allServices = await repository.findAll();
      expect(allServices).toHaveLength(5);

      const healthyServices = await repository.getHealthyServices();
      expect(healthyServices).toHaveLength(2); // plex, overseerr

      const unhealthyServices = await repository.getUnhealthyServices();
      expect(unhealthyServices).toHaveLength(2); // sonarr (degraded), radarr (unhealthy)

      const staleServices = await repository.getServicesStalerThan(60); // 1 hour
      expect(staleServices).toHaveLength(1); // uptime-kuma
      expect(staleServices[0].serviceName).toBe('uptime-kuma');
    });
  });
});
