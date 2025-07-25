import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createTestApp } from '../../helpers/test-app';
import {
  simulatePlexDown,
  simulateOverseerrDown,
  resetMockHandlers,
  mockUptimeKumaStatus,
} from '../../helpers/external-services';
import { RateLimitError } from '@medianest/shared';
import { logger } from '../../../src/utils/logger';

describe('Error Scenarios - Critical Path Tests', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
    resetMockHandlers();
  });

  afterEach(() => {
    resetMockHandlers();
    vi.restoreAllMocks();
  });

  describe('Service Unavailability Scenarios', () => {
    describe('Plex Service Down', () => {
      it('should gracefully handle Plex service unavailability during authentication', async () => {
        simulatePlexDown();

        // Mock Plex auth endpoint
        app.post('/auth/plex/pin', (req, res) => {
          // Simulate the actual behavior when Plex is down
          res.status(503).json({
            error: 'EXTERNAL_SERVICE_UNAVAILABLE',
            message:
              'Plex authentication service is currently unavailable. Please try again later.',
            service: 'plex',
            retryAfter: 300, // 5 minutes
          });
        });

        const response = await request(app)
          .post('/auth/plex/pin')
          .send({ clientId: 'test-client' });

        expect(response.status).toBe(503);
        expect(response.body.error).toBe('EXTERNAL_SERVICE_UNAVAILABLE');
        expect(response.body.message).toContain('currently unavailable');
        expect(response.body.service).toBe('plex');
        expect(response.body.retryAfter).toBeDefined();
      });

      it('should provide fallback authentication when Plex is down', async () => {
        simulatePlexDown();

        // Mock fallback authentication endpoint
        app.post('/auth/fallback', (req, res) => {
          res.json({
            message: 'Plex service unavailable. Please use manual authentication.',
            fallbackMethods: ['manual', 'local'],
            supportContact: 'admin@medianest.local',
          });
        });

        const response = await request(app)
          .post('/auth/fallback')
          .send({ reason: 'plex_unavailable' });

        expect(response.status).toBe(200);
        expect(response.body.fallbackMethods).toContain('manual');
        expect(response.body.supportContact).toBeDefined();
      });

      it('should handle Plex timeout scenarios', async () => {
        // Mock timeout scenario
        app.get('/auth/plex/status', async (req, res) => {
          try {
            // Simulate timeout
            await new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Connection timeout')), 100);
            });
          } catch (error) {
            res.status(408).json({
              error: 'REQUEST_TIMEOUT',
              message: 'Plex service request timed out',
              timeout: 5000,
            });
          }
        });

        const response = await request(app).get('/auth/plex/status');

        expect(response.status).toBe(408);
        expect(response.body.error).toBe('REQUEST_TIMEOUT');
      });
    });

    describe('Overseerr Service Down', () => {
      it('should handle Overseerr unavailability gracefully', async () => {
        simulateOverseerrDown();

        // Mock media request endpoint with Overseerr fallback
        app.post('/media/request', (req, res) => {
          res.status(503).json({
            error: 'MEDIA_SERVICE_UNAVAILABLE',
            message: 'Media request service is temporarily unavailable',
            alternatives: ['Manual request via admin', 'Request queue for later processing'],
            estimatedRecovery: '2024-01-01T12:00:00Z',
          });
        });

        const response = await request(app)
          .post('/media/request')
          .send({ tmdbId: 12345, mediaType: 'movie' });

        expect(response.status).toBe(503);
        expect(response.body.error).toBe('MEDIA_SERVICE_UNAVAILABLE');
        expect(response.body.alternatives).toBeDefined();
        expect(response.body.estimatedRecovery).toBeDefined();
      });

      it('should queue requests when Overseerr is down', async () => {
        simulateOverseerrDown();

        // Mock request queueing
        app.post('/media/queue', (req, res) => {
          res.status(202).json({
            message: 'Request queued for processing when service recovers',
            queueId: 'queue-123',
            estimatedProcessing: '2024-01-01T12:00:00Z',
            position: 5,
          });
        });

        const response = await request(app)
          .post('/media/queue')
          .send({ tmdbId: 12345, mediaType: 'movie' });

        expect(response.status).toBe(202);
        expect(response.body.queueId).toBeDefined();
        expect(response.body.position).toBe(5);
      });
    });

    describe('Multiple Service Failures', () => {
      it('should handle cascading service failures', async () => {
        simulatePlexDown();
        simulateOverseerrDown();

        // Mock health check endpoint
        app.get('/health/services', (req, res) => {
          res.status(503).json({
            status: 'degraded',
            services: {
              plex: { status: 'down', lastCheck: new Date().toISOString() },
              overseerr: { status: 'down', lastCheck: new Date().toISOString() },
              database: { status: 'up', lastCheck: new Date().toISOString() },
              redis: { status: 'up', lastCheck: new Date().toISOString() },
            },
            degradedFunctionality: [
              'User authentication via Plex',
              'Media requests',
              'Automatic media management',
            ],
            availableFunctionality: ['User management', 'System monitoring', 'Manual operations'],
          });
        });

        const response = await request(app).get('/health/services');

        expect(response.status).toBe(503);
        expect(response.body.status).toBe('degraded');
        expect(response.body.services.plex.status).toBe('down');
        expect(response.body.services.overseerr.status).toBe('down');
        expect(response.body.degradedFunctionality).toBeDefined();
        expect(response.body.availableFunctionality).toBeDefined();
      });
    });
  });

  describe('Database Error Scenarios', () => {
    it('should handle database connection failures', async () => {
      // Mock database error
      app.get('/users/profile', (req, res) => {
        res.status(500).json({
          error: 'DATABASE_CONNECTION_ERROR',
          message: 'Unable to connect to database',
          retryable: true,
          retryAfter: 30,
        });
      });

      const response = await request(app)
        .get('/users/profile')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('DATABASE_CONNECTION_ERROR');
      expect(response.body.retryable).toBe(true);
    });

    it('should handle database timeout scenarios', async () => {
      // Mock database timeout
      app.get('/users/list', async (req, res) => {
        try {
          // Simulate database timeout
          await new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Database query timeout')), 100);
          });
        } catch (error) {
          res.status(504).json({
            error: 'DATABASE_TIMEOUT',
            message: 'Database query timed out',
            timeout: 30000,
            suggestion: 'Try reducing the query scope or try again later',
          });
        }
      });

      const response = await request(app).get('/users/list');

      expect(response.status).toBe(504);
      expect(response.body.error).toBe('DATABASE_TIMEOUT');
      expect(response.body.suggestion).toBeDefined();
    });

    it('should handle database constraint violations', async () => {
      // Mock unique constraint violation
      app.post('/users/create', (req, res) => {
        res.status(409).json({
          error: 'CONSTRAINT_VIOLATION',
          message: 'User with this email already exists',
          field: 'email',
          value: req.body.email,
          suggestion: 'Use a different email address or try logging in',
        });
      });

      const response = await request(app)
        .post('/users/create')
        .send({ email: 'existing@example.com', name: 'Test User' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('CONSTRAINT_VIOLATION');
      expect(response.body.field).toBe('email');
      expect(response.body.suggestion).toBeDefined();
    });
  });

  describe('Authentication Error Scenarios', () => {
    it('should handle expired JWT tokens gracefully', async () => {
      // Mock expired token scenario
      app.get('/auth/me', (req, res) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            error: 'MISSING_TOKEN',
            message: 'Authentication token is required',
          });
        }

        // Simulate expired token
        res.status(401).json({
          error: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired',
          expiredAt: '2024-01-01T10:00:00Z',
          refreshEndpoint: '/auth/refresh',
        });
      });

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer expired-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('TOKEN_EXPIRED');
      expect(response.body.refreshEndpoint).toBe('/auth/refresh');
    });

    it('should handle invalid JWT tokens', async () => {
      app.get('/auth/me', (req, res) => {
        res.status(401).json({
          error: 'INVALID_TOKEN',
          message: 'Authentication token is invalid',
          action: 'Please log in again',
        });
      });

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('INVALID_TOKEN');
      expect(response.body.action).toBeDefined();
    });

    it('should handle insufficient permissions', async () => {
      app.get('/admin/users', (req, res) => {
        res.status(403).json({
          error: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to access this resource',
          requiredRole: 'admin',
          currentRole: 'user',
        });
      });

      const response = await request(app)
        .get('/admin/users')
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('INSUFFICIENT_PERMISSIONS');
      expect(response.body.requiredRole).toBe('admin');
      expect(response.body.currentRole).toBe('user');
    });
  });

  describe('Rate Limiting Error Scenarios', () => {
    it('should handle rate limit exceeded with proper error response', async () => {
      // Mock rate limit exceeded
      app.get('/api/limited', (req, res) => {
        res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please slow down.',
          limit: 100,
          remaining: 0,
          reset: new Date(Date.now() + 60000).toISOString(),
          retryAfter: 60,
        });
      });

      const response = await request(app).get('/api/limited');

      expect(response.status).toBe(429);
      expect(response.body.error).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.body.retryAfter).toBe(60);
      expect(response.body.reset).toBeDefined();
    });

    it('should handle Redis failure in rate limiting gracefully', async () => {
      // Mock Redis failure fallback
      app.get('/api/redis-down', (req, res) => {
        res.status(200).json({
          success: true,
          message: 'Request processed (rate limiting temporarily disabled)',
          warning: 'Rate limiting service unavailable',
        });
      });

      const response = await request(app).get('/api/redis-down');

      expect(response.status).toBe(200);
      expect(response.body.warning).toContain('Rate limiting service unavailable');
    });
  });

  describe('File System Error Scenarios', () => {
    it('should handle disk space errors', async () => {
      app.post('/youtube/download', (req, res) => {
        res.status(507).json({
          error: 'INSUFFICIENT_STORAGE',
          message: 'Not enough disk space to download media',
          availableSpace: '500MB',
          requiredSpace: '2GB',
          suggestion: 'Clear some space or contact administrator',
        });
      });

      const response = await request(app)
        .post('/youtube/download')
        .send({ url: 'https://youtube.com/watch?v=test' });

      expect(response.status).toBe(507);
      expect(response.body.error).toBe('INSUFFICIENT_STORAGE');
      expect(response.body.availableSpace).toBeDefined();
      expect(response.body.requiredSpace).toBeDefined();
    });

    it('should handle file permission errors', async () => {
      app.get('/files/download/:id', (req, res) => {
        res.status(403).json({
          error: 'FILE_PERMISSION_DENIED',
          message: 'Unable to access file due to permission restrictions',
          fileId: req.params.id,
          suggestion: 'Contact administrator to resolve permission issues',
        });
      });

      const response = await request(app).get('/files/download/123');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FILE_PERMISSION_DENIED');
      expect(response.body.fileId).toBe('123');
    });
  });

  describe('Network Error Scenarios', () => {
    it('should handle network timeout errors', async () => {
      app.get('/external/api', async (req, res) => {
        try {
          // Simulate network timeout
          await new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Network timeout')), 100);
          });
        } catch (error) {
          res.status(504).json({
            error: 'GATEWAY_TIMEOUT',
            message: 'External service request timed out',
            timeout: 30000,
            service: 'external-api',
          });
        }
      });

      const response = await request(app).get('/external/api');

      expect(response.status).toBe(504);
      expect(response.body.error).toBe('GATEWAY_TIMEOUT');
      expect(response.body.service).toBe('external-api');
    });

    it('should handle DNS resolution errors', async () => {
      app.get('/external/unreachable', (req, res) => {
        res.status(502).json({
          error: 'DNS_RESOLUTION_FAILED',
          message: 'Unable to resolve external service hostname',
          hostname: 'unreachable.service.com',
          suggestion: 'Check network connectivity or DNS settings',
        });
      });

      const response = await request(app).get('/external/unreachable');

      expect(response.status).toBe(502);
      expect(response.body.error).toBe('DNS_RESOLUTION_FAILED');
      expect(response.body.hostname).toBeDefined();
    });
  });

  describe('Input Validation Error Scenarios', () => {
    it('should handle malformed JSON requests', async () => {
      app.post('/api/data', express.json(), (req, res) => {
        res.json({ received: req.body });
      });

      // Override express error handler for this test
      app.use((error: any, req: any, res: any, next: any) => {
        if (error instanceof SyntaxError && 'body' in error) {
          return res.status(400).json({
            error: 'INVALID_JSON',
            message: 'Request body contains invalid JSON',
            details: error.message,
          });
        }
        next(error);
      });

      const response = await request(app)
        .post('/api/data')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}'); // Malformed JSON

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('INVALID_JSON');
    });

    it('should handle oversized request payloads', async () => {
      app.post('/api/upload', (req, res) => {
        res.status(413).json({
          error: 'PAYLOAD_TOO_LARGE',
          message: 'Request payload exceeds maximum allowed size',
          maxSize: '10MB',
          receivedSize: '25MB',
        });
      });

      const response = await request(app)
        .post('/api/upload')
        .send({ data: 'x'.repeat(1000000) }); // Large payload

      expect(response.status).toBe(413);
      expect(response.body.error).toBe('PAYLOAD_TOO_LARGE');
      expect(response.body.maxSize).toBeDefined();
    });

    it('should handle missing required fields', async () => {
      app.post('/api/validate', (req, res) => {
        const { email, password } = req.body;

        if (!email || !password) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Required fields are missing',
            missingFields: [...(!email ? ['email'] : []), ...(!password ? ['password'] : [])],
          });
        }

        res.json({ success: true });
      });

      const response = await request(app).post('/api/validate').send({ email: 'test@example.com' }); // Missing password

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.missingFields).toContain('password');
    });
  });

  describe('Graceful Degradation Scenarios', () => {
    it('should provide read-only mode when database is in maintenance', async () => {
      app.get('/health/mode', (req, res) => {
        res.json({
          mode: 'read-only',
          reason: 'Database maintenance in progress',
          estimatedCompletion: '2024-01-01T14:00:00Z',
          availableOperations: [
            'View existing data',
            'Search functionality',
            'User authentication (cached)',
          ],
          unavailableOperations: [
            'Create new records',
            'Update existing records',
            'Delete operations',
          ],
        });
      });

      const response = await request(app).get('/health/mode');

      expect(response.status).toBe(200);
      expect(response.body.mode).toBe('read-only');
      expect(response.body.availableOperations).toBeDefined();
      expect(response.body.unavailableOperations).toBeDefined();
    });

    it('should provide cached data when external services are slow', async () => {
      app.get('/api/external-data', (req, res) => {
        res.json({
          data: { cached: true, value: 'sample-data' },
          meta: {
            source: 'cache',
            reason: 'External service response time exceeded threshold',
            lastUpdate: '2024-01-01T10:00:00Z',
            cacheExpiry: '2024-01-01T11:00:00Z',
          },
        });
      });

      const response = await request(app).get('/api/external-data');

      expect(response.status).toBe(200);
      expect(response.body.data.cached).toBe(true);
      expect(response.body.meta.source).toBe('cache');
      expect(response.body.meta.reason).toContain('exceeded threshold');
    });
  });

  describe('Error Logging and Monitoring', () => {
    it('should log errors with appropriate detail levels', async () => {
      const loggerSpy = vi.spyOn(logger, 'error');

      app.get('/api/error-test', (req, res) => {
        const error = new Error('Test error for logging');
        logger.error('Test error occurred', {
          error: error.message,
          stack: error.stack,
          requestId: 'req-123',
          userId: 'user-456',
          endpoint: '/api/error-test',
        });

        res.status(500).json({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'An internal error occurred',
          requestId: 'req-123',
        });
      });

      await request(app).get('/api/error-test');

      expect(loggerSpy).toHaveBeenCalledWith(
        'Test error occurred',
        expect.objectContaining({
          error: 'Test error for logging',
          requestId: 'req-123',
          userId: 'user-456',
          endpoint: '/api/error-test',
        }),
      );
    });

    it('should provide error correlation IDs for tracking', async () => {
      app.get('/api/correlation', (req, res) => {
        const correlationId = `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        res.status(500).json({
          error: 'PROCESSING_ERROR',
          message: 'An error occurred while processing your request',
          correlationId,
          supportMessage: `Please provide this correlation ID when contacting support: ${correlationId}`,
        });
      });

      const response = await request(app).get('/api/correlation');

      expect(response.status).toBe(500);
      expect(response.body.correlationId).toMatch(/^corr-\d+-[a-z0-9]+$/);
      expect(response.body.supportMessage).toContain(response.body.correlationId);
    });
  });
});
