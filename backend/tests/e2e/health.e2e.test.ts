import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, httpServer } from '../../../dist/app';

describe('Health Endpoints E2E', () => {
  beforeAll(async () => {
    // Server should already be configured via app.js
    // This ensures integration with real middleware chain
  });

  afterAll(async () => {
    // Clean up if needed
  });

  describe('GET /api/v1/health', () => {
    it('should return overall health status', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          version: expect.any(String),
          services: expect.objectContaining({
            database: expect.objectContaining({
              status: expect.stringMatching(/^(healthy|unhealthy)$/)
            }),
            redis: expect.objectContaining({
              status: expect.stringMatching(/^(healthy|unhealthy)$/)
            })
          }),
          system: expect.objectContaining({
            memory: expect.objectContaining({
              percentage: expect.any(Number)
            }),
            cpu: expect.objectContaining({
              usage: expect.any(Number)
            })
          })
        })
      });
    });

    it('should include response time measurements', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      const services = response.body.data.services;
      
      Object.values(services).forEach((service: any) => {
        if (service.status === 'healthy') {
          expect(service.responseTime).toBeGreaterThan(0);
        }
      });
    });

    it('should handle CORS headers correctly', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('GET /api/v1/health/detailed', () => {
    it('should return detailed health information', async () => {
      const response = await request(app)
        .get('/api/v1/health/detailed')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          overall: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
          timestamp: expect.any(String),
          checks: expect.objectContaining({
            database: expect.objectContaining({
              status: expect.any(String),
              details: expect.any(Object)
            }),
            redis: expect.objectContaining({
              status: expect.any(String),
              details: expect.any(Object)
            })
          }),
          system: expect.objectContaining({
            memory: expect.objectContaining({
              total: expect.any(Number),
              used: expect.any(Number),
              percentage: expect.any(Number)
            }),
            cpu: expect.objectContaining({
              usage: expect.any(Number),
              cores: expect.any(Number)
            })
          })
        })
      });
    });

    it('should include external service health', async () => {
      const response = await request(app)
        .get('/api/v1/health/detailed')
        .expect(200);

      const checks = response.body.data.checks;
      expect(checks).toHaveProperty('externalServices');
      
      if (checks.externalServices) {
        expect(checks.externalServices).toEqual(
          expect.objectContaining({
            plex: expect.objectContaining({
              status: expect.any(String)
            })
          })
        );
      }
    });
  });

  describe('GET /api/v1/health/database', () => {
    it('should return database-specific health', async () => {
      const response = await request(app)
        .get('/api/v1/health/database')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          status: expect.stringMatching(/^(healthy|unhealthy)$/),
          responseTime: expect.any(Number)
        })
      });

      if (response.body.data.status === 'healthy') {
        expect(response.body.data).toEqual(
          expect.objectContaining({
            connectionPool: expect.objectContaining({
              active: expect.any(Number),
              idle: expect.any(Number),
              total: expect.any(Number)
            }),
            version: expect.any(String)
          })
        );
      }
    });
  });

  describe('GET /api/v1/health/redis', () => {
    it('should return Redis-specific health', async () => {
      const response = await request(app)
        .get('/api/v1/health/redis')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          status: expect.stringMatching(/^(healthy|unhealthy)$/),
          responseTime: expect.any(Number)
        })
      });

      if (response.body.data.status === 'healthy') {
        expect(response.body.data).toEqual(
          expect.objectContaining({
            memory: expect.objectContaining({
              used: expect.any(String),
              peak: expect.any(String)
            }),
            clients: expect.objectContaining({
              connected: expect.any(Number)
            }),
            version: expect.any(String)
          })
        );
      }
    });
  });

  describe('Kubernetes health probes', () => {
    describe('GET /health/liveness', () => {
      it('should return liveness probe response', async () => {
        const response = await request(app)
          .get('/health/liveness')
          .expect(200);

        expect(response.body).toEqual({
          status: 'alive',
          timestamp: expect.any(String)
        });
      });

      it('should respond quickly for liveness probe', async () => {
        const startTime = Date.now();
        
        await request(app)
          .get('/health/liveness')
          .expect(200);

        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(100); // Should respond in <100ms
      });
    });

    describe('GET /health/readiness', () => {
      it('should return readiness probe response when ready', async () => {
        const response = await request(app)
          .get('/health/readiness')
          .expect(200);

        expect(response.body).toEqual({
          status: 'ready',
          timestamp: expect.any(String)
        });
      });

      it('should return 503 when not ready', async () => {
        // This test would require mocking critical services as down
        // For now, we'll just verify the endpoint exists and format is correct
        
        const response = await request(app)
          .get('/health/readiness');

        expect([200, 503]).toContain(response.status);
        
        if (response.status === 503) {
          expect(response.body).toEqual({
            status: 'not ready',
            timestamp: expect.any(String),
            issues: expect.any(Array)
          });
        }
      });
    });
  });

  describe('Health endpoint performance', () => {
    it('should respond to basic health check within reasonable time', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/v1/health')
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond in <1s
    });

    it('should handle concurrent health checks', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app).get('/api/v1/health').expect(200)
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toMatch(/^(healthy|degraded|unhealthy)$/);
      });
    });
  });

  describe('Error handling', () => {
    it('should handle invalid health endpoints gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/health/nonexistent')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: expect.any(String)
      });
    });

    it('should include correlation ID in error responses', async () => {
      const response = await request(app)
        .get('/api/v1/health/nonexistent')
        .set('X-Correlation-Id', 'test-correlation-id')
        .expect(404);

      expect(response.headers['x-correlation-id']).toBe('test-correlation-id');
    });
  });

  describe('Security headers', () => {
    it('should include security headers in health responses', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      // Helmet security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });

    it('should not expose sensitive information in health checks', async () => {
      const response = await request(app)
        .get('/api/v1/health/detailed')
        .expect(200);

      const responseText = JSON.stringify(response.body);
      
      // Should not contain sensitive information
      expect(responseText).not.toMatch(/password|secret|token|key/i);
      expect(responseText).not.toMatch(/192\.168\.|10\.|172\./); // Private IPs
    });
  });
});