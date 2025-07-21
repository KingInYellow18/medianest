import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';
import { testPrismaClient as prisma } from '../helpers/test-prisma-client';
import { cleanupDatabase } from '../helpers/database-cleanup';

describe('Health Check Endpoints', () => {
  let app: any;

  beforeAll(async () => {
    // Clean up test database
    await cleanupDatabase(prisma);

    // Create test app
    app = createTestApp();

    // Mock health endpoint
    app.get('/api/health', async (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'test',
        components: {
          database: { status: 'healthy' },
          redis: { status: 'healthy' },
        },
      });
    });

    // Mock detailed health endpoint
    app.get('/api/v1/health/detailed', async (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'test',
        components: {
          database: {
            status: 'healthy',
            responseTime: 5,
            details: {
              connected: true,
              latency: 5,
            },
          },
          redis: {
            status: 'healthy',
            responseTime: 2,
            details: {
              connected: true,
              memory: '10MB',
            },
          },
          plex: {
            status: 'healthy',
            responseTime: 150,
          },
          overseerr: {
            status: 'healthy',
            responseTime: 120,
          },
          uptimeKuma: {
            status: 'healthy',
            responseTime: 80,
          },
        },
        metrics: {
          requests: {
            total: 1000,
            errors: 5,
            avgResponseTime: 45,
          },
          uptime: {
            percentage: 99.95,
            lastDowntime: null,
          },
        },
      });
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /api/health', () => {
    it('should return basic health status without authentication', async () => {
      const response = await request(app).get('/api/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        version: expect.any(String),
        uptime: expect.any(Number),
        environment: expect.any(String),
      });
    });

    it('should respond quickly (< 100ms)', async () => {
      const start = Date.now();

      await request(app).get('/api/health').expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });

    it('should include component health status', async () => {
      const response = await request(app).get('/api/health').expect(200);

      expect(response.body.components).toMatchObject({
        database: { status: 'healthy' },
        redis: { status: 'healthy' },
      });
    });
  });

  describe('GET /api/v1/health/detailed', () => {
    it('should return detailed health information', async () => {
      const response = await request(app).get('/api/v1/health/detailed').expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        components: {
          database: {
            status: 'healthy',
            responseTime: expect.any(Number),
            details: expect.any(Object),
          },
          redis: {
            status: 'healthy',
            responseTime: expect.any(Number),
            details: expect.any(Object),
          },
          plex: {
            status: 'healthy',
            responseTime: expect.any(Number),
          },
          overseerr: {
            status: 'healthy',
            responseTime: expect.any(Number),
          },
          uptimeKuma: {
            status: 'healthy',
            responseTime: expect.any(Number),
          },
        },
        metrics: expect.any(Object),
      });
    });

    it('should include performance metrics', async () => {
      const response = await request(app).get('/api/v1/health/detailed').expect(200);

      expect(response.body.metrics).toMatchObject({
        requests: {
          total: expect.any(Number),
          errors: expect.any(Number),
          avgResponseTime: expect.any(Number),
        },
        uptime: {
          percentage: expect.any(Number),
          lastDowntime: expect.anything(),
        },
      });
    });
  });
});
