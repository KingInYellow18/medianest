import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ServiceStatusRepository,
  ServiceStatusUpdate,
} from '@/repositories/service-status.repository';
import { getTestPrismaClient, cleanDatabase, disconnectDatabase } from '../../helpers/database';
import { setupPrismaMock, MockDecimal } from '../../helpers/prisma-mock';

// Setup Prisma mocking for this test suite
setupPrismaMock();

// Mock the Decimal import from Prisma
vi.mock('@prisma/client', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    Decimal: MockDecimal,
    PrismaClient: vi.fn(),
  };
});

describe('ServiceStatusRepository Integration Tests', () => {
  let repository: ServiceStatusRepository;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = getTestPrismaClient();
    repository = new ServiceStatusRepository(mockPrisma);
    await cleanDatabase();

    // Mock upsert operations
    mockPrisma.serviceStatus.upsert.mockImplementation(({ where, create, update }) => {
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

    // Mock findUnique operations
    mockPrisma.serviceStatus.findUnique.mockImplementation(({ where }) => {
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

    // Mock findMany operations
    mockPrisma.serviceStatus.findMany.mockImplementation(({ where, orderBy }) => {
      const services = [
        { serviceName: 'overseerr', status: 'unhealthy' },
        { serviceName: 'plex', status: 'healthy' },
        { serviceName: 'uptime-kuma', status: 'healthy' },
      ];

      let filtered = services;
      if (where?.status) {
        filtered = services.filter((s) => s.status === where.status);
      }
      if (where?.NOT?.status) {
        filtered = services.filter((s) => s.status !== where.NOT.status);
      }

      return Promise.resolve(
        filtered.map((s) => ({
          id: Math.random(),
          ...s,
          responseTimeMs: 150,
          lastCheckAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );
    });

    // Mock aggregate operations
    mockPrisma.serviceStatus.aggregate.mockResolvedValue({
      _avg: { responseTimeMs: 200 },
    });
  });

  afterEach(async () => {
    await cleanDatabase();
    vi.resetAllMocks();
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

      mockPrisma.serviceStatus.upsert.mockResolvedValueOnce({
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
    });

    it('should return null for non-existent service', async () => {
      mockPrisma.serviceStatus.findUnique.mockResolvedValueOnce(null);

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
    });

    it('should return empty array when no services exist', async () => {
      mockPrisma.serviceStatus.findMany.mockResolvedValueOnce([]);

      const result = await repository.findAll();
      expect(result).toHaveLength(0);
    });
  });

  describe('updateStatus', () => {
    it('should update status and response time', async () => {
      mockPrisma.serviceStatus.upsert.mockResolvedValueOnce({
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
      mockPrisma.serviceStatus.upsert.mockResolvedValueOnce({
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
      mockPrisma.serviceStatus.upsert.mockResolvedValueOnce({
        id: 1,
        serviceName: 'plex',
        uptimePercentage: new MockDecimal(98.75),
      });

      const result = await repository.updateUptimePercentage('plex', 98.75);

      expect(result.uptimePercentage?.toNumber()).toBe(98.75);
    });

    it('should handle high precision decimals', async () => {
      mockPrisma.serviceStatus.upsert.mockResolvedValueOnce({
        id: 1,
        serviceName: 'plex',
        uptimePercentage: new MockDecimal(99.99),
      });

      const result = await repository.updateUptimePercentage('plex', 99.99);

      expect(result.uptimePercentage?.toNumber()).toBe(99.99);
    });

    it('should handle edge cases', async () => {
      mockPrisma.serviceStatus.upsert
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
      mockPrisma.serviceStatus.findMany.mockResolvedValueOnce([
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
      mockPrisma.serviceStatus.findMany.mockResolvedValueOnce([]);

      const result = await repository.getHealthyServices();
      expect(result).toHaveLength(0);
    });
  });

  describe('getUnhealthyServices', () => {
    it('should return unhealthy and null status services', async () => {
      mockPrisma.serviceStatus.findMany.mockResolvedValueOnce([
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

  describe('getAverageResponseTime', () => {
    it('should calculate average response time', async () => {
      mockPrisma.serviceStatus.aggregate.mockResolvedValueOnce({
        _avg: { responseTimeMs: 200 },
      });

      const result = await repository.getAverageResponseTime('plex');
      expect(result).toBe(200);
    });

    it('should return null for non-existent service', async () => {
      mockPrisma.serviceStatus.aggregate.mockResolvedValueOnce({
        _avg: { responseTimeMs: null },
      });

      const result = await repository.getAverageResponseTime('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('real-world scenarios', () => {
    it('should handle service monitoring workflow', async () => {
      const serviceName = 'plex';

      // Mock sequence of status updates
      mockPrisma.serviceStatus.upsert
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

      mockPrisma.serviceStatus.findUnique
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
  });
});
