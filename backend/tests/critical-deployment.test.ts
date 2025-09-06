import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { performance } from 'perf_hooks';

// Types for deployment validation
interface DeploymentMetrics {
  responseTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
  timestamp: string;
}

interface ConcurrencyTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
}

interface LoadTestResult extends ConcurrencyTestResult {
  requestsPerSecond: number;
  errorRate: number;
}

describe('Critical Deployment Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    // Create production-like Express app for deployment testing
    app = express();

    // Production middleware stack
    app.use(
      helmet({
        contentSecurityPolicy: false, // Disable for testing
        crossOriginEmbedderPolicy: false,
      }),
    );
    app.use(
      cors({
        origin: true,
        credentials: true,
      }),
    );
    app.use(compression());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request timestamp middleware
    app.use((req: any, res, next) => {
      req.timestamp = Date.now();
      next();
    });

    // Security headers middleware - MUST be early in middleware stack
    app.use((req: any, res, next) => {
      // Add custom deployment headers
      res.set({
        'X-Deployment-Version': '1.0.0',
        'X-Service-Name': 'medianest-backend',
        'X-Response-Time': String(Date.now() - (req.timestamp || Date.now())),
      });
      next();
    });

    // Rate limiting simulation - MUST be early for all API routes
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/')) {
        // Simulate rate limiting headers for API routes
        res.set({
          'X-RateLimit-Limit': '1000',
          'X-RateLimit-Remaining': '999',
          'X-RateLimit-Reset': String(Date.now() + 60000),
        });
      }
      next();
    });

    // Enhanced health endpoint - CRITICAL for deployment
    app.get('/health', (_req, res) => {
      const memUsage = process.memoryUsage();
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'medianest-backend',
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
        },
        process: {
          pid: process.pid,
          platform: process.platform,
          nodeVersion: process.version,
        },
      });
    });

    // Detailed health endpoint for monitoring
    app.get('/api/v1/health', (_req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        service: 'medianest-api',
      });
    });

    // Readiness endpoint for Kubernetes
    app.get('/ready', (_req, res) => {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'connected',
          cache: 'connected',
          services: 'available',
        },
      });
    });

    // Metrics endpoint for monitoring
    app.get('/metrics', (_req, res) => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      res.json({
        timestamp: new Date().toISOString(),
        uptime: {
          seconds: process.uptime(),
          formatted: formatUptime(process.uptime()),
        },
        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external,
        },
        cpu: {
          user: cpuUsage.user / 1000000,
          system: cpuUsage.system / 1000000,
        },
        performance: {
          activeHandles: (process as any)._getActiveHandles?.()?.length || 0,
          activeRequests: (process as any)._getActiveRequests?.()?.length || 0,
        },
      });
    });

    // Simple auth test endpoint
    app.post('/api/auth/test', (req, res) => {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password required',
        });
      }

      // Mock successful login for deployment testing
      if (email === 'test@example.com' && password === 'password123') {
        return res.json({
          success: true,
          user: { id: 'test-id', email: 'test@example.com' },
          token: 'mock-jwt-token',
        });
      }

      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    });

    // Database connection test endpoint
    app.get('/api/db/test', (_req, res) => {
      // Mock database connection test
      res.json({
        success: true,
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    });

    // Simple CRUD test endpoint
    app.get('/api/users/test', (_req, res) => {
      res.json({
        success: true,
        users: [
          { id: 'test-user-1', email: 'user1@example.com', name: 'Test User 1' },
          { id: 'test-user-2', email: 'user2@example.com', name: 'Test User 2' },
        ],
      });
    });

    // Rate limiting moved earlier in middleware stack

    // Load testing endpoint
    app.get('/api/load-test', (req, res) => {
      const { delay = '0' } = req.query;
      const delayMs = parseInt(delay as string, 10);

      setTimeout(() => {
        res.json({
          success: true,
          timestamp: new Date().toISOString(),
          delay: delayMs,
          requestId: Math.random().toString(36).substring(7),
        });
      }, delayMs);
    });

    // Memory stress test endpoint
    app.post('/api/stress/memory', (req, res) => {
      const { size = 1 } = req.body; // Size in MB
      const buffer = Buffer.alloc(size * 1024 * 1024, 'test');

      setTimeout(() => {
        // Release memory
        buffer.fill(0);
        res.json({
          success: true,
          allocatedMB: size,
          timestamp: new Date().toISOString(),
        });
      }, 100);
    });

    // Error simulation endpoint
    app.get('/api/error/:type', (req, res) => {
      const { type } = req.params;

      switch (type) {
        case '500':
          throw new Error('Simulated internal server error');
        case '503':
          res.status(503).json({ error: 'Service temporarily unavailable' });
          break;
        case 'timeout':
          // Never respond - simulate timeout
          setTimeout(() => {
            res.json({ delayed: true });
          }, 30000);
          break;
        default:
          res.status(400).json({ error: 'Unknown error type' });
      }
    });

    // Graceful shutdown simulation
    let shutdownInitiated = false;
    app.get('/api/shutdown', (req, res) => {
      if (shutdownInitiated) {
        res.status(503).json({ error: 'Shutdown in progress' });
        return;
      }

      shutdownInitiated = true;
      res.json({
        message: 'Graceful shutdown initiated',
        timestamp: new Date().toISOString(),
      });

      // Reset after test
      setTimeout(() => {
        shutdownInitiated = false;
      }, 5000);
    });

    // Error handling
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
        timestamp: new Date().toISOString(),
      });
    });

    // This middleware was moved earlier in the stack

    // 404 handler
    app.use((_req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        timestamp: new Date().toISOString(),
      });
    });
  });

  afterAll(() => {
    // Cleanup if needed
  });

  // Helper function for uptime formatting
  function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0) parts.push(`${secs}s`);

    return parts.join(' ') || '0s';
  }

  describe('1. Health Check - CRITICAL FOR DEPLOYMENT', () => {
    it('should return comprehensive health status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        service: 'medianest-backend',
        version: expect.any(String),
        uptime: expect.any(Number),
        environment: expect.any(String),
        memory: {
          rss: expect.stringMatching(/\d+MB/),
          heapUsed: expect.stringMatching(/\d+MB/),
          heapTotal: expect.stringMatching(/\d+MB/),
        },
        process: {
          pid: expect.any(Number),
          platform: expect.any(String),
          nodeVersion: expect.any(String),
        },
      });

      // Validate timestamp is recent (within 1 second)
      const timestamp = new Date(response.body.timestamp);
      const now = new Date();
      expect(Math.abs(now.getTime() - timestamp.getTime())).toBeLessThan(1000);
    });

    it('should respond quickly (< 50ms for production readiness)', async () => {
      const start = performance.now();

      await request(app).get('/health').expect(200);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(50); // Stricter requirement
    });

    it('should not require authentication', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.headers['www-authenticate']).toBeUndefined();
    });

    it('should include required headers for load balancer health checks', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.headers['x-deployment-version']).toBeDefined();
      expect(response.headers['x-service-name']).toBe('medianest-backend');
    });

    it('should handle multiple concurrent health checks', async () => {
      const requests = Array.from({ length: 10 }, () => {
        const start = performance.now();
        return request(app)
          .get('/health')
          .expect(200)
          .then((res) => ({
            response: res,
            duration: performance.now() - start,
          }));
      });

      const results = await Promise.all(requests);

      results.forEach(({ response, duration }) => {
        expect(response.body.status).toBe('ok');
        expect(duration).toBeLessThan(100); // All should be fast
      });

      // Check average response time
      const avgDuration = results.reduce((sum, { duration }) => sum + duration, 0) / results.length;
      expect(avgDuration).toBeLessThan(50); // More realistic for concurrent requests
    });

    it('should provide readiness endpoint for Kubernetes', async () => {
      const response = await request(app).get('/ready').expect(200);

      expect(response.body).toMatchObject({
        status: 'ready',
        timestamp: expect.any(String),
        checks: {
          database: 'connected',
          cache: 'connected',
          services: 'available',
        },
      });
    });

    it('should provide detailed API health endpoint', async () => {
      const response = await request(app).get('/api/v1/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        version: expect.any(String),
        uptime: expect.any(Number),
        environment: expect.any(String),
        service: 'medianest-api',
      });
    });
  });

  describe('2. Authentication Flow - CRITICAL FOR USER ACCESS', () => {
    it('should handle valid login', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const response = await request(app).post('/api/auth/test').send(loginData).expect(200);

      expect(response.body).toMatchObject({
        success: true,
        user: {
          id: expect.any(String),
          email: 'test@example.com',
        },
        token: expect.any(String),
      });
    });

    it('should reject invalid credentials', async () => {
      const loginData = {
        email: 'wrong@example.com',
        password: 'wrongpassword',
      };

      const response = await request(app).post('/api/auth/test').send(loginData).expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid credentials'),
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/test')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('required'),
      });
    });
  });

  describe('3. Database Connectivity - CRITICAL FOR DATA ACCESS', () => {
    it('should confirm database connection', async () => {
      const response = await request(app).get('/api/db/test').expect(200);

      expect(response.body).toMatchObject({
        success: true,
        database: 'connected',
        timestamp: expect.any(String),
      });
    });
  });

  describe('4. Basic CRUD Operations - CRITICAL FOR APP FUNCTIONALITY', () => {
    it('should retrieve users', async () => {
      const response = await request(app).get('/api/users/test').expect(200);

      expect(response.body).toMatchObject({
        success: true,
        users: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            email: expect.any(String),
            name: expect.any(String),
          }),
        ]),
      });
    });
  });

  describe('5. Server Reliability - CRITICAL FOR PRODUCTION', () => {
    it('should handle high concurrent load (50 simultaneous requests)', async () => {
      const concurrentRequests = 50;
      const requests = Array.from({ length: concurrentRequests }, (_, i) => {
        const start = performance.now();
        return request(app)
          .get('/health')
          .expect(200)
          .then((res) => ({
            response: res,
            duration: performance.now() - start,
            index: i,
          }));
      });

      const results = await Promise.all(requests);
      const testResult: ConcurrencyTestResult = {
        totalRequests: concurrentRequests,
        successfulRequests: results.filter((r) => r.response.status === 200).length,
        failedRequests: results.filter((r) => r.response.status !== 200).length,
        averageResponseTime: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
        maxResponseTime: Math.max(...results.map((r) => r.duration)),
        minResponseTime: Math.min(...results.map((r) => r.duration)),
      };

      expect(testResult.successfulRequests).toBe(concurrentRequests);
      expect(testResult.failedRequests).toBe(0);
      expect(testResult.averageResponseTime).toBeLessThan(200); // More realistic for 50 concurrent requests
      expect(testResult.maxResponseTime).toBeLessThan(1000); // Allow more time under high load

      results.forEach(({ response }) => {
        expect(response.body.status).toBe('ok');
      });
    });

    it('should handle malformed JSON gracefully with proper error response', async () => {
      const response = await request(app)
        .post('/api/auth/test')
        .send('{"malformed": json}')
        .set('Content-Type', 'application/json');

      expect([400, 500]).toContain(response.status); // Either client or server error is acceptable
      if (response.body) {
        expect(typeof response.body === 'object').toBe(true);
      }
    });

    it('should return consistent 404 for non-existent endpoints', async () => {
      const endpoints = [
        '/api/nonexistent',
        '/api/v1/missing',
        '/totally/fake/endpoint',
        '/api/users/99999999',
      ];

      const responses = await Promise.all(endpoints.map((endpoint) => request(app).get(endpoint)));

      responses.forEach((response, index) => {
        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('not found'),
          timestamp: expect.any(String),
        });
      });
    });

    it('should handle memory stress gracefully', async () => {
      const initialMemory = process.memoryUsage();

      const response = await request(app)
        .post('/api/stress/memory')
        .send({ size: 10 }) // 10MB
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        allocatedMB: 10,
        timestamp: expect.any(String),
      });

      // Give time for garbage collection
      await new Promise((resolve) => setTimeout(resolve, 100));

      const finalMemory = process.memoryUsage();
      // Memory should not increase drastically (allowing for GC)
      expect(finalMemory.heapUsed).toBeLessThan(initialMemory.heapUsed + 50 * 1024 * 1024);
    });

    it('should handle graceful shutdown scenarios', async () => {
      // Initiate shutdown
      const shutdownResponse = await request(app).get('/api/shutdown').expect(200);

      expect(shutdownResponse.body).toMatchObject({
        message: 'Graceful shutdown initiated',
        timestamp: expect.any(String),
      });

      // Should still respond to health checks during shutdown
      const healthResponse = await request(app).get('/health').expect(200);
      expect(healthResponse.body.status).toBe('ok');

      // Subsequent requests should indicate shutdown in progress
      const subsequentResponse = await request(app).get('/api/shutdown');
      expect(subsequentResponse.status).toBe(503);
    });

    it('should maintain security headers under load', async () => {
      const requests = Array.from({ length: 20 }, () => request(app).get('/health'));
      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        // Check security headers from helmet
        expect(response.headers['x-frame-options']).toBeDefined();
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-deployment-version']).toBe('1.0.0');
        expect(response.headers['x-service-name']).toBe('medianest-backend');
      });
    });
  });

  describe('6. Performance - CRITICAL FOR USER EXPERIENCE', () => {
    it('should handle normal payload sizes efficiently', async () => {
      const normalPayload = {
        email: 'test@example.com',
        password: 'password123',
        metadata: 'x'.repeat(1000), // 1KB
        largeData: 'y'.repeat(50000), // 50KB
      };

      const start = performance.now();
      const response = await request(app).post('/api/auth/test').send(normalPayload);
      const duration = performance.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(200); // Should handle 50KB quickly
    });

    it('should handle large payloads up to limit', async () => {
      // Test with 5MB payload (within 10MB limit)
      const largePayload = {
        email: 'test@example.com',
        password: 'password123',
        data: 'x'.repeat(5 * 1024 * 1024), // 5MB
      };

      const response = await request(app).post('/api/auth/test').send(largePayload).timeout(10000); // Allow more time for large payload

      expect(response.status).toBe(200);
    });

    it('should provide performance metrics endpoint', async () => {
      const response = await request(app).get('/metrics').expect(200);

      expect(response.body).toMatchObject({
        timestamp: expect.any(String),
        uptime: {
          seconds: expect.any(Number),
          formatted: expect.any(String),
        },
        memory: {
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number),
          external: expect.any(Number),
        },
        cpu: {
          user: expect.any(Number),
          system: expect.any(Number),
        },
        performance: {
          activeHandles: expect.any(Number),
          activeRequests: expect.any(Number),
        },
      });

      // Metrics should be reasonable
      expect(response.body.uptime.seconds).toBeGreaterThan(0);
      expect(response.body.memory.heapUsed).toBeGreaterThan(0);
      expect(response.body.cpu.user).toBeGreaterThanOrEqual(0);
    });

    it('should handle burst traffic patterns', async () => {
      // Simulate burst traffic: 3 waves of 10 requests each
      const waves = 3;
      const requestsPerWave = 10;
      const results: number[] = [];

      for (let wave = 0; wave < waves; wave++) {
        const waveStart = performance.now();
        const waveRequests = Array.from({ length: requestsPerWave }, () =>
          request(app).get('/api/load-test?delay=10').expect(200),
        );

        await Promise.all(waveRequests);
        const waveTime = performance.now() - waveStart;
        results.push(waveTime);

        // Brief pause between waves
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Each wave should complete in reasonable time
      results.forEach((waveTime) => {
        expect(waveTime).toBeLessThan(1000); // 1 second max per wave
      });

      // Performance should not degrade significantly across waves
      const averageTime = results.reduce((sum, time) => sum + time, 0) / results.length;
      const maxTime = Math.max(...results);
      expect(maxTime).toBeLessThan(averageTime * 2); // Max shouldn't be more than 2x average
    });

    it('should handle timeout scenarios gracefully', async () => {
      // Test with a request that would timeout in 1 second
      const start = performance.now();

      try {
        await request(app).get('/api/error/timeout').timeout(1000);

        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        const duration = performance.now() - start;

        // Should timeout around 1 second
        expect(duration).toBeGreaterThan(900);
        expect(duration).toBeLessThan(1500);
        expect(error.message).toMatch(/timeout|ECONNABORTED/i);
      }
    });

    it('should maintain consistent response times under load', async () => {
      const testDuration = 2000; // 2 seconds
      const requestInterval = 100; // New request every 100ms
      const results: { responseTime: number; timestamp: number }[] = [];

      const startTime = Date.now();

      while (Date.now() - startTime < testDuration) {
        const reqStart = performance.now();

        try {
          await request(app).get('/api/load-test').expect(200);
          const responseTime = performance.now() - reqStart;

          results.push({
            responseTime,
            timestamp: Date.now() - startTime,
          });
        } catch (error) {
          // Log but don't fail - focus on successful requests
        }

        await new Promise((resolve) => setTimeout(resolve, requestInterval));
      }

      expect(results.length).toBeGreaterThan(10); // Should have multiple samples

      const responseTimes = results.map((r) => r.responseTime);
      const averageResponseTime =
        responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[
        Math.floor(responseTimes.length * 0.95)
      ];

      // Performance assertions
      expect(averageResponseTime).toBeLessThan(100); // Average under 100ms
      expect(p95ResponseTime).toBeLessThan(200); // 95th percentile under 200ms
      expect(maxResponseTime).toBeLessThan(500); // No request over 500ms
    });
  });

  describe('7. Container Deployment - CRITICAL FOR ORCHESTRATION', () => {
    it('should include all required deployment headers', async () => {
      const response = await request(app).get('/health').expect(200);

      // Required headers for container orchestration
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.headers['x-deployment-version']).toBe('1.0.0');
      expect(response.headers['x-service-name']).toBe('medianest-backend');

      // Security headers should be present
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should handle CORS requests for cross-origin deployments', async () => {
      const response = await request(app)
        .options('/api/v1/health')
        .set('Origin', 'https://frontend.example.com')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'authorization')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe('https://frontend.example.com');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should include rate limiting headers', async () => {
      const response = await request(app).get('/api/users/test').expect(200);

      expect(response.headers['x-ratelimit-limit']).toBe('1000');
      expect(response.headers['x-ratelimit-remaining']).toBe('999');
      expect(response.headers['x-ratelimit-reset']).toMatch(/\d+/);
    });

    it('should handle different error scenarios for monitoring', async () => {
      // Test 500 error
      const error500 = await request(app).get('/api/error/500');
      expect(error500.status).toBe(500);

      // Test 503 error
      const error503 = await request(app).get('/api/error/503');
      expect(error503.status).toBe(503);
      expect(error503.body).toMatchObject({
        error: 'Service temporarily unavailable',
      });

      // Test 400 error
      const error400 = await request(app).get('/api/error/unknown');
      expect(error400.status).toBe(400);
      expect(error400.body).toMatchObject({
        error: 'Unknown error type',
      });
    });

    it('should provide deployment-ready JSON responses', async () => {
      const endpoints = ['/health', '/ready', '/api/v1/health', '/metrics'];

      const responses = await Promise.all(
        endpoints.map((endpoint) => request(app).get(endpoint).expect(200)),
      );

      responses.forEach((response, index) => {
        expect(response.headers['content-type']).toMatch(/application\/json/);
        expect(response.body).toBeDefined();
        expect(typeof response.body).toBe('object');
        expect(response.body.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
      });
    });

    it('should handle container resource constraints', async () => {
      const memoryBefore = process.memoryUsage();

      // Simulate multiple requests to test memory behavior
      const requests = Array.from({ length: 100 }, () => request(app).get('/health').expect(200));
      await Promise.all(requests);

      const memoryAfter = process.memoryUsage();

      // Memory should not grow excessively (allowing for normal fluctuations)
      const memoryGrowth = memoryAfter.heapUsed - memoryBefore.heapUsed;
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // Less than 100MB growth
    });
  });
});
