import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { server, http, HttpResponse } from '../msw/setup';
import { generateToken } from '@/utils/jwt.util';
import prisma from '@/config/database';
import { redisClient } from '@/config/redis';
import { encrypt } from '@/utils/encryption.util';

// Mock Redis and Prisma
vi.mock('@/config/redis', () => ({
  redisClient: {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    eval: vi.fn(),
  },
}));

vi.mock('@/config/database', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    userSession: {
      findFirst: vi.fn(),
    },
    serviceConfig: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    serviceStatus: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('Service Status Endpoints', () => {
  let authToken: string;
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    authToken = generateToken({ id: 'user-1', role: 'USER' });
    adminToken = generateToken({ id: 'admin-1', role: 'ADMIN' });

    // Default auth setup
    (prisma.userSession.findFirst as any).mockImplementation(({ where }) => {
      if (where.token === authToken) {
        return Promise.resolve({
          id: 'session-1',
          userId: 'user-1',
          token: authToken,
          expiresAt: new Date(Date.now() + 3600000),
          isActive: true,
          user: {
            id: 'user-1',
            email: 'test@example.com',
            username: 'testuser',
            displayName: 'Test User',
            role: 'USER',
            isActive: true,
          },
        });
      }
      if (where.token === adminToken) {
        return Promise.resolve({
          id: 'session-2',
          userId: 'admin-1',
          token: adminToken,
          expiresAt: new Date(Date.now() + 3600000),
          isActive: true,
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            username: 'admin',
            displayName: 'Admin User',
            role: 'ADMIN',
            isActive: true,
          },
        });
      }
      return null;
    });

    // Mock service configurations
    (prisma.serviceConfig.findMany as any).mockResolvedValue([
      {
        id: 'plex-config',
        service: 'PLEX',
        url: 'https://plex.example.com',
        apiKey: null,
        isActive: true,
        settings: { name: 'My Plex Server' },
      },
      {
        id: 'overseerr-config',
        service: 'OVERSEERR',
        url: 'https://overseerr.example.com',
        apiKey: 'encrypted:api:key',
        isActive: true,
        settings: {},
      },
      {
        id: 'uptime-config',
        service: 'UPTIME_KUMA',
        url: 'https://uptime.example.com',
        apiKey: 'encrypted:uptime:key',
        isActive: true,
        settings: {},
      },
    ]);
  });

  describe('GET /api/v1/dashboard/status', () => {
    it('should return status for all configured services', async () => {
      // Mock cache miss
      (redisClient.get as any).mockResolvedValue(null);

      // Service status will be fetched fresh
      const response = await request(app)
        .get('/api/v1/dashboard/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          services: expect.arrayContaining([
            expect.objectContaining({
              service: 'PLEX',
              status: 'ONLINE',
              responseTime: expect.any(Number),
            }),
            expect.objectContaining({
              service: 'OVERSEERR',
              status: 'ONLINE',
              responseTime: expect.any(Number),
            }),
            expect.objectContaining({
              service: 'UPTIME_KUMA',
              status: 'ONLINE',
              responseTime: expect.any(Number),
            }),
          ]),
          lastUpdated: expect.any(String),
        },
      });

      // Verify cache was set
      expect(redisClient.setex).toHaveBeenCalled();
    });

    it('should return cached status when available', async () => {
      const cachedData = {
        services: [
          {
            service: 'PLEX',
            status: 'ONLINE',
            responseTime: 50,
            lastChecked: new Date().toISOString(),
          },
        ],
        lastUpdated: new Date().toISOString(),
      };

      (redisClient.get as any).mockResolvedValue(JSON.stringify(cachedData));

      const response = await request(app)
        .get('/api/v1/dashboard/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toEqual(cachedData);
      // Should not make any service calls when cache hit
      expect(prisma.serviceStatus.create).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      (redisClient.get as any).mockResolvedValue(null);

      // Override Plex handler to return error
      server.use(
        http.get('*/library/sections', () => {
          return HttpResponse.json({ error: 'Internal error' }, { status: 500 });
        }),
      );

      const response = await request(app)
        .get('/api/v1/dashboard/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const plexService = response.body.data.services.find((s: any) => s.service === 'PLEX');
      expect(plexService).toMatchObject({
        service: 'PLEX',
        status: 'OFFLINE',
        error: expect.stringContaining('error'),
      });
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/v1/dashboard/status').expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should force refresh when requested', async () => {
      const cachedData = {
        services: [{ service: 'PLEX', status: 'OFFLINE' }],
        lastUpdated: new Date().toISOString(),
      };

      (redisClient.get as any).mockResolvedValue(JSON.stringify(cachedData));

      const response = await request(app)
        .get('/api/v1/dashboard/status')
        .query({ refresh: true })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should delete cache and fetch fresh
      expect(redisClient.del).toHaveBeenCalledWith('service_status:all');
      expect(response.body.data.services.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/dashboard/status/:service', () => {
    it('should return status for specific service', async () => {
      (prisma.serviceConfig.findUnique as any).mockResolvedValue({
        id: 'plex-config',
        service: 'PLEX',
        url: 'https://plex.example.com',
        isActive: true,
      });

      const response = await request(app)
        .get('/api/v1/dashboard/status/plex')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          service: 'PLEX',
          status: 'ONLINE',
          responseTime: expect.any(Number),
          details: expect.any(Object),
        },
      });
    });

    it('should handle non-configured service', async () => {
      (prisma.serviceConfig.findUnique as any).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/dashboard/status/plex')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Service not configured',
        },
      });
    });

    it('should validate service name', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/status/invalid-service')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/dashboard/uptime-kuma/monitors', () => {
    it('should return monitor list with stats', async () => {
      (prisma.serviceConfig.findUnique as any).mockResolvedValue({
        id: 'uptime-config',
        service: 'UPTIME_KUMA',
        url: 'https://uptime.example.com',
        apiKey: 'encrypted:uptime:key',
        isActive: true,
      });

      const response = await request(app)
        .get('/api/v1/dashboard/uptime-kuma/monitors')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          monitors: expect.arrayContaining([
            expect.objectContaining({
              id: 1,
              name: 'Plex Server',
              url: 'https://plex.example.com',
              uptime24h: 100,
              uptime30d: 99.5,
              avgPing: 25,
              status: 'up',
              lastCheck: expect.any(String),
            }),
            expect.objectContaining({
              id: 2,
              name: 'Overseerr',
              url: 'https://overseerr.example.com',
              uptime24h: 99.9,
              uptime30d: 99.8,
              avgPing: 30,
              status: 'up',
            }),
          ]),
        },
      });
    });

    it('should handle Uptime Kuma API errors', async () => {
      (prisma.serviceConfig.findUnique as any).mockResolvedValue({
        id: 'uptime-config',
        service: 'UPTIME_KUMA',
        url: 'https://uptime.example.com',
        apiKey: 'encrypted:uptime:key',
        isActive: true,
      });

      server.use(
        http.get('*/api/monitors', () => {
          return HttpResponse.json({ error: 'Service unavailable' }, { status: 503 });
        }),
      );

      const response = await request(app)
        .get('/api/v1/dashboard/uptime-kuma/monitors')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(503);

      expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('GET /api/v1/dashboard/history', () => {
    it('should return service status history', async () => {
      const now = new Date();
      const history = [
        {
          id: 'status-1',
          service: 'PLEX',
          status: 'ONLINE',
          responseTime: 45,
          checkedAt: new Date(now.getTime() - 3600000),
        },
        {
          id: 'status-2',
          service: 'PLEX',
          status: 'ONLINE',
          responseTime: 50,
          checkedAt: new Date(now.getTime() - 1800000),
        },
        {
          id: 'status-3',
          service: 'PLEX',
          status: 'OFFLINE',
          responseTime: null,
          error: 'Connection timeout',
          checkedAt: new Date(now.getTime() - 900000),
        },
      ];

      (prisma.serviceStatus.findMany as any).mockResolvedValue(history);

      const response = await request(app)
        .get('/api/v1/dashboard/history')
        .query({ service: 'PLEX', hours: 2 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          service: 'PLEX',
          history: expect.arrayContaining([
            expect.objectContaining({
              status: 'ONLINE',
              responseTime: 45,
            }),
          ]),
          uptime: expect.any(Number),
          avgResponseTime: expect.any(Number),
        },
      });

      expect(prisma.serviceStatus.findMany).toHaveBeenCalledWith({
        where: {
          service: 'PLEX',
          checkedAt: {
            gte: expect.any(Date),
          },
        },
        orderBy: { checkedAt: 'desc' },
      });
    });

    it('should default to 24 hours of history', async () => {
      (prisma.serviceStatus.findMany as any).mockResolvedValue([]);

      await request(app)
        .get('/api/v1/dashboard/history')
        .query({ service: 'PLEX' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const whereClause = (prisma.serviceStatus.findMany as any).mock.calls[0][0].where;
      const hoursDiff = (Date.now() - whereClause.checkedAt.gte.getTime()) / (1000 * 60 * 60);
      expect(Math.round(hoursDiff)).toBe(24);
    });

    it('should validate parameters', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/history')
        .query({ service: 'invalid', hours: 999 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Service Configuration Endpoints (Admin Only)', () => {
    describe('GET /api/v1/admin/services', () => {
      it('should return all service configurations for admin', async () => {
        const response = await request(app)
          .get('/api/v1/admin/services')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              id: 'plex-config',
              service: 'PLEX',
              url: 'https://plex.example.com',
              isActive: true,
              hasApiKey: false,
            }),
            expect.objectContaining({
              id: 'overseerr-config',
              service: 'OVERSEERR',
              url: 'https://overseerr.example.com',
              isActive: true,
              hasApiKey: true,
            }),
          ]),
        });

        // API keys should not be exposed
        response.body.data.forEach((config: any) => {
          expect(config.apiKey).toBeUndefined();
        });
      });

      it('should require admin role', async () => {
        const response = await request(app)
          .get('/api/v1/admin/services')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body.error.code).toBe('FORBIDDEN');
      });
    });

    describe('POST /api/v1/admin/services', () => {
      it('should create new service configuration', async () => {
        (prisma.serviceConfig.create as any).mockResolvedValue({
          id: 'new-config',
          service: 'TAUTULLI',
          url: 'https://tautulli.example.com',
          apiKey: 'encrypted:new:key',
          isActive: true,
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const response = await request(app)
          .post('/api/v1/admin/services')
          .send({
            service: 'TAUTULLI',
            url: 'https://tautulli.example.com',
            apiKey: 'test-api-key',
            settings: {
              libraryId: '1',
            },
          })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(201);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            id: 'new-config',
            service: 'TAUTULLI',
            url: 'https://tautulli.example.com',
            hasApiKey: true,
            isActive: true,
          },
        });

        // Verify API key was encrypted
        expect(prisma.serviceConfig.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            apiKey: expect.stringContaining(':'), // Encrypted format
          }),
        });
      });

      it('should validate service configuration', async () => {
        const response = await request(app)
          .post('/api/v1/admin/services')
          .send({
            service: 'INVALID_SERVICE',
            url: 'not-a-url',
          })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should prevent duplicate service configurations', async () => {
        (prisma.serviceConfig.create as any).mockRejectedValue({
          code: 'P2002',
          meta: { target: ['service'] },
        });

        const response = await request(app)
          .post('/api/v1/admin/services')
          .send({
            service: 'PLEX',
            url: 'https://plex2.example.com',
          })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(409);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Service configuration already exists',
          },
        });
      });
    });

    describe('PUT /api/v1/admin/services/:id', () => {
      it('should update service configuration', async () => {
        (prisma.serviceConfig.findUnique as any).mockResolvedValue({
          id: 'plex-config',
          service: 'PLEX',
          url: 'https://plex.example.com',
          isActive: true,
        });

        (prisma.serviceConfig.update as any).mockResolvedValue({
          id: 'plex-config',
          service: 'PLEX',
          url: 'https://new-plex.example.com',
          isActive: false,
          updatedAt: new Date(),
        });

        const response = await request(app)
          .put('/api/v1/admin/services/plex-config')
          .send({
            url: 'https://new-plex.example.com',
            isActive: false,
          })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            id: 'plex-config',
            url: 'https://new-plex.example.com',
            isActive: false,
          },
        });
      });

      it('should encrypt new API keys', async () => {
        (prisma.serviceConfig.findUnique as any).mockResolvedValue({
          id: 'overseerr-config',
          service: 'OVERSEERR',
          apiKey: 'encrypted:old:key',
        });

        (prisma.serviceConfig.update as any).mockResolvedValue({
          id: 'overseerr-config',
          service: 'OVERSEERR',
          apiKey: 'encrypted:new:key',
        });

        await request(app)
          .put('/api/v1/admin/services/overseerr-config')
          .send({
            apiKey: 'new-api-key',
          })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(prisma.serviceConfig.update).toHaveBeenCalledWith({
          where: { id: 'overseerr-config' },
          data: expect.objectContaining({
            apiKey: expect.stringContaining(':'), // Encrypted
          }),
        });
      });
    });

    describe('DELETE /api/v1/admin/services/:id', () => {
      it('should delete service configuration', async () => {
        (prisma.serviceConfig.findUnique as any).mockResolvedValue({
          id: 'tautulli-config',
          service: 'TAUTULLI',
        });

        (prisma.serviceConfig.delete as any).mockResolvedValue({
          id: 'tautulli-config',
        });

        const response = await request(app)
          .delete('/api/v1/admin/services/tautulli-config')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            message: 'Service configuration deleted successfully',
          },
        });

        expect(prisma.serviceConfig.delete).toHaveBeenCalledWith({
          where: { id: 'tautulli-config' },
        });
      });

      it('should handle non-existent configuration', async () => {
        (prisma.serviceConfig.findUnique as any).mockResolvedValue(null);

        const response = await request(app)
          .delete('/api/v1/admin/services/invalid-id')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);

        expect(response.body.error.code).toBe('NOT_FOUND');
      });
    });
  });
});
