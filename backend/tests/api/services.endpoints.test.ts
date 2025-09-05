import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/db/prisma';
import { databaseCleanup } from '../helpers/database-cleanup';
import { createAuthToken, createAdminToken } from '../helpers/auth';
import { testUsers } from '../fixtures/test-data';

describe('Services Endpoints - Critical Path', () => {
  let userToken: string;
  let adminToken: string;
  let testUser: any;
  let adminUser: any;

  beforeAll(async () => {
    await databaseCleanup.cleanAll();

    // Create test users
    testUser = await prisma.user.create({
      data: {
        plexId: testUsers[0].plexId,
        plexUsername: testUsers[0].username,
        email: testUsers[0].email,
        role: testUsers[0].role,
        status: testUsers[0].status,
        plexToken: 'encrypted-token',
      },
    });

    adminUser = await prisma.user.create({
      data: {
        plexId: testUsers[1].plexId,
        plexUsername: testUsers[1].username,
        email: testUsers[1].email,
        role: testUsers[1].role,
        status: testUsers[1].status,
        plexToken: 'encrypted-admin-token',
      },
    });

    userToken = createAuthToken(testUser);
    adminToken = createAuthToken(adminUser);
  });

  afterAll(async () => {
    await databaseCleanup.cleanAll();
    await prisma.$disconnect();
  });

  describe('GET /api/v1/services/status', () => {
    it('should get all service statuses', async () => {
      const response = await request(app)
        .get('/api/v1/services/status')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          services: expect.arrayContaining([
            expect.objectContaining({
              name: expect.any(String),
              status: expect.stringMatching(/^(online|offline|degraded)$/),
              responseTime: expect.any(Number),
              lastChecked: expect.any(String),
            }),
          ]),
          overall: expect.objectContaining({
            status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
            uptime: expect.any(Number),
          }),
        },
      });
    });

    it('should include service-specific metadata', async () => {
      const response = await request(app)
        .get('/api/v1/services/status')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const services = response.body.data.services;
      const plexService = services.find((s: any) => s.name === 'plex');
      const overseerrService = services.find((s: any) => s.name === 'overseerr');

      if (plexService) {
        expect(plexService).toHaveProperty('version');
        expect(plexService).toHaveProperty('serverName');
      }

      if (overseerrService) {
        expect(overseerrService).toHaveProperty('version');
        expect(overseerrService).toHaveProperty('requestCount');
      }
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/v1/services/status').expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/services/:serviceName/status', () => {
    it('should get specific service status - Plex', async () => {
      const response = await request(app)
        .get('/api/v1/services/plex/status')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          name: 'plex',
          status: expect.stringMatching(/^(online|offline|degraded)$/),
          responseTime: expect.any(Number),
          lastChecked: expect.any(String),
          details: expect.objectContaining({
            version: expect.any(String),
            serverName: expect.any(String),
            libraryCount: expect.any(Number),
          }),
        },
      });
    });

    it('should get specific service status - Overseerr', async () => {
      const response = await request(app)
        .get('/api/v1/services/overseerr/status')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          name: 'overseerr',
          status: expect.stringMatching(/^(online|offline|degraded)$/),
          responseTime: expect.any(Number),
          details: expect.objectContaining({
            version: expect.any(String),
            requestCount: expect.any(Number),
          }),
        },
      });
    });

    it('should get specific service status - Uptime Kuma', async () => {
      const response = await request(app)
        .get('/api/v1/services/uptime-kuma/status')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          name: 'uptime-kuma',
          status: expect.stringMatching(/^(online|offline|degraded)$/),
          responseTime: expect.any(Number),
          details: expect.objectContaining({
            monitorCount: expect.any(Number),
            uptime: expect.any(Number),
          }),
        },
      });
    });

    it('should handle invalid service name', async () => {
      const response = await request(app)
        .get('/api/v1/services/invalid-service/status')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Service not found',
        },
      });
    });
  });

  describe('POST /api/v1/services/:serviceName/test', () => {
    it('should test Plex connection', async () => {
      const response = await request(app)
        .post('/api/v1/services/plex/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          serviceName: 'plex',
          connectionTest: expect.objectContaining({
            success: expect.any(Boolean),
            responseTime: expect.any(Number),
            error: expect.any(String).or(null),
          }),
          authentication: expect.objectContaining({
            success: expect.any(Boolean),
            error: expect.any(String).or(null),
          }),
        },
      });
    });

    it('should test Overseerr connection', async () => {
      const response = await request(app)
        .post('/api/v1/services/overseerr/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          serviceName: 'overseerr',
          connectionTest: expect.objectContaining({
            success: expect.any(Boolean),
            responseTime: expect.any(Number),
          }),
          apiTest: expect.objectContaining({
            success: expect.any(Boolean),
            version: expect.any(String).or(null),
          }),
        },
      });
    });

    it('should require admin privileges', async () => {
      const response = await request(app)
        .post('/api/v1/services/plex/test')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Admin access required',
        },
      });
    });

    it('should handle invalid service name', async () => {
      const response = await request(app)
        .post('/api/v1/services/invalid-service/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Service not found',
        },
      });
    });
  });

  describe('GET /api/v1/services/config', () => {
    it('should get service configuration for admin', async () => {
      const response = await request(app)
        .get('/api/v1/services/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          services: expect.arrayContaining([
            expect.objectContaining({
              name: expect.any(String),
              enabled: expect.any(Boolean),
              configured: expect.any(Boolean),
              url: expect.any(String).or(null),
            }),
          ]),
        },
      });
    });

    it('should hide sensitive configuration from regular users', async () => {
      const response = await request(app)
        .get('/api/v1/services/config')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          services: expect.arrayContaining([
            expect.objectContaining({
              name: expect.any(String),
              enabled: expect.any(Boolean),
              configured: expect.any(Boolean),
              // Should not include URLs or API keys for regular users
            }),
          ]),
        },
      });

      // Ensure no sensitive data is exposed
      const services = response.body.data.services;
      services.forEach((service: any) => {
        expect(service).not.toHaveProperty('apiKey');
        expect(service).not.toHaveProperty('url');
        expect(service).not.toHaveProperty('token');
      });
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/v1/services/config').expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/services/:serviceName/config', () => {
    it('should update service configuration for admin', async () => {
      const configUpdate = {
        enabled: true,
        url: 'https://overseerr.example.com',
        apiKey: 'new-api-key-123',
      };

      const response = await request(app)
        .put('/api/v1/services/overseerr/config')
        .send(configUpdate)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          serviceName: 'overseerr',
          updated: true,
          previousConfig: expect.any(Object),
          newConfig: expect.objectContaining({
            enabled: true,
            // API keys should be masked in response
            apiKey: expect.stringMatching(/^\*+$/),
          }),
        },
      });
    });

    it('should validate configuration parameters', async () => {
      const invalidConfig = {
        enabled: 'not-boolean',
        url: 'invalid-url',
      };

      const response = await request(app)
        .put('/api/v1/services/plex/config')
        .send(invalidConfig)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringContaining('Invalid configuration'),
          validationErrors: expect.any(Array),
        },
      });
    });

    it('should require admin privileges', async () => {
      const response = await request(app)
        .put('/api/v1/services/plex/config')
        .send({ enabled: false })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Admin access required',
        },
      });
    });
  });

  describe('GET /api/v1/services/logs', () => {
    it('should get service logs for admin', async () => {
      const response = await request(app)
        .get('/api/v1/services/logs')
        .query({ service: 'plex', limit: 50 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          logs: expect.arrayContaining([
            expect.objectContaining({
              timestamp: expect.any(String),
              service: 'plex',
              level: expect.stringMatching(/^(info|warn|error|debug)$/),
              message: expect.any(String),
            }),
          ]),
          totalCount: expect.any(Number),
          hasMore: expect.any(Boolean),
        },
      });
    });

    it('should filter logs by service', async () => {
      const response = await request(app)
        .get('/api/v1/services/logs')
        .query({ service: 'overseerr' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const logs = response.body.data.logs;
      logs.forEach((log: any) => {
        expect(log.service).toBe('overseerr');
      });
    });

    it('should filter logs by level', async () => {
      const response = await request(app)
        .get('/api/v1/services/logs')
        .query({ level: 'error', limit: 20 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const logs = response.body.data.logs;
      logs.forEach((log: any) => {
        expect(log.level).toBe('error');
      });
    });

    it('should require admin privileges', async () => {
      const response = await request(app)
        .get('/api/v1/services/logs')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Admin access required',
        },
      });
    });
  });

  describe('POST /api/v1/services/restart', () => {
    it('should restart all services for admin', async () => {
      const response = await request(app)
        .post('/api/v1/services/restart')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Service restart initiated',
          services: expect.arrayContaining([
            expect.objectContaining({
              name: expect.any(String),
              restartInitiated: expect.any(Boolean),
            }),
          ]),
        },
      });
    });

    it('should restart specific service', async () => {
      const response = await request(app)
        .post('/api/v1/services/restart')
        .send({ service: 'plex' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Plex service restart initiated',
          service: 'plex',
          restartInitiated: true,
        },
      });
    });

    it('should require admin privileges', async () => {
      const response = await request(app)
        .post('/api/v1/services/restart')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Admin access required',
        },
      });
    });
  });
});
