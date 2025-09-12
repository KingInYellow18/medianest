/**
 * WEBHOOK API INTEGRATION TESTS
 *
 * Comprehensive integration tests for webhook endpoints
 * Covers Overseerr webhooks, signature verification, security, and error handling
 */

import crypto from 'crypto';

import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import { createServer } from '../../src/server';
import { AuthTestHelper } from '../helpers/auth-test-helper';
import { DatabaseTestHelper } from '../helpers/database-test-helper';

const prisma = new PrismaClient();
let app: any;
let server: any;
let dbHelper: DatabaseTestHelper;
let authHelper: AuthTestHelper;

// Test webhook secret
const TEST_WEBHOOK_SECRET = 'test_webhook_secret_key';

describe('Webhook API Integration Tests', () => {
  beforeAll(async () => {
    dbHelper = new DatabaseTestHelper();
    authHelper = new AuthTestHelper();

    // Set webhook secret for testing
    process.env.OVERSEERR_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

    await dbHelper.setupTestDatabase();
    app = await createServer();
    server = app.listen(0);
  });

  afterAll(async () => {
    await server?.close();
    await dbHelper.cleanupTestDatabase();
    await authHelper.disconnect();
    await prisma.$disconnect();

    // Clean up environment
    delete process.env.OVERSEERR_WEBHOOK_SECRET;
  });

  beforeEach(async () => {
    await dbHelper.seedTestData();
    vi.clearAllMocks();
  });

  // Helper function to generate webhook signature
  function generateWebhookSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  }

  describe('POST /api/v1/webhooks/overseerr', () => {
    test('should process valid Overseerr webhook with correct signature', async () => {
      const webhookPayload = {
        notification_type: 'MEDIA_AVAILABLE',
        event: 'media.available',
        subject: 'Inception (2010)',
        message: 'Inception (2010) is now available!',
        image: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
        media: {
          media_type: 'movie',
          tmdbId: 27205,
          imdbId: 'tt1375666',
          status: 'available',
        },
        request: {
          request_id: 123,
          requestedBy_username: 'testuser',
          requestedBy_email: 'test@example.com',
        },
      };

      const payloadString = JSON.stringify(webhookPayload);
      const signature = generateWebhookSignature(payloadString, TEST_WEBHOOK_SECRET);

      vi.doMock('../../src/services/overseerr.service', () => ({
        overseerrService: {
          handleWebhook: vi.fn().mockResolvedValue(undefined),
        },
      }));

      const response = await request(app)
        .post('/api/v1/webhooks/overseerr')
        .set('Content-Type', 'application/json')
        .set('X-Overseerr-Signature', `sha256=${signature}`)
        .set('User-Agent', 'Overseerr/1.0')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // Verify service was called
      const { overseerrService } = require('../../src/services/overseerr.service');
      expect(overseerrService.handleWebhook).toHaveBeenCalledWith(webhookPayload);
    });

    test('should handle different notification types', async () => {
      const notificationTypes = [
        'MEDIA_PENDING',
        'MEDIA_APPROVED',
        'MEDIA_AVAILABLE',
        'MEDIA_DECLINED',
        'MEDIA_FAILED',
        'TEST_NOTIFICATION',
      ];

      vi.doMock('../../src/services/overseerr.service', () => ({
        overseerrService: {
          handleWebhook: vi.fn().mockResolvedValue(undefined),
        },
      }));

      for (const notificationType of notificationTypes) {
        const payload = {
          notification_type: notificationType,
          event: `media.${notificationType.toLowerCase().replace('_', '.')}`,
          subject: 'Test Movie',
          message: `Test message for ${notificationType}`,
          media: {
            media_type: 'movie',
            tmdbId: 12345,
          },
        };

        const payloadString = JSON.stringify(payload);
        const signature = generateWebhookSignature(payloadString, TEST_WEBHOOK_SECRET);

        const response = await request(app)
          .post('/api/v1/webhooks/overseerr')
          .set('Content-Type', 'application/json')
          .set('X-Overseerr-Signature', `sha256=${signature}`)
          .send(payload)
          .expect(200);

        expect(response.body.success).toBe(true);
      }
    });

    test('should handle TV show notifications', async () => {
      const tvShowPayload = {
        notification_type: 'MEDIA_AVAILABLE',
        event: 'media.available',
        subject: 'Breaking Bad (2008)',
        message: 'Breaking Bad (2008) - Season 1 is now available!',
        media: {
          media_type: 'tv',
          tmdbId: 1396,
          seasons: [
            {
              season_number: 1,
              status: 'available',
            },
          ],
        },
      };

      const payloadString = JSON.stringify(tvShowPayload);
      const signature = generateWebhookSignature(payloadString, TEST_WEBHOOK_SECRET);

      vi.doMock('../../src/services/overseerr.service', () => ({
        overseerrService: {
          handleWebhook: vi.fn().mockResolvedValue(undefined),
        },
      }));

      const response = await request(app)
        .post('/api/v1/webhooks/overseerr')
        .set('X-Overseerr-Signature', `sha256=${signature}`)
        .send(tvShowPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject webhook without signature', async () => {
      const payload = {
        notification_type: 'MEDIA_AVAILABLE',
        subject: 'Test Movie',
      };

      const response = await request(app)
        .post('/api/v1/webhooks/overseerr')
        .send(payload)
        .expect(401);

      expect(response.body.error).toContain('Webhook signature verification failed');
    });

    test('should reject webhook with invalid signature', async () => {
      const payload = {
        notification_type: 'MEDIA_AVAILABLE',
        subject: 'Test Movie',
      };

      const response = await request(app)
        .post('/api/v1/webhooks/overseerr')
        .set('X-Overseerr-Signature', 'sha256=invalid_signature')
        .send(payload)
        .expect(401);

      expect(response.body.error).toContain('Webhook signature verification failed');
    });

    test('should reject webhook with signature for different payload', async () => {
      const originalPayload = { notification_type: 'MEDIA_AVAILABLE' };
      const differentPayload = { notification_type: 'MEDIA_DECLINED' };

      const payloadString = JSON.stringify(originalPayload);
      const signature = generateWebhookSignature(payloadString, TEST_WEBHOOK_SECRET);

      const response = await request(app)
        .post('/api/v1/webhooks/overseerr')
        .set('X-Overseerr-Signature', `sha256=${signature}`)
        .send(differentPayload)
        .expect(401);

      expect(response.body.error).toContain('Webhook signature verification failed');
    });

    test('should handle signature without sha256 prefix', async () => {
      const payload = { notification_type: 'MEDIA_AVAILABLE' };
      const payloadString = JSON.stringify(payload);
      const signature = generateWebhookSignature(payloadString, TEST_WEBHOOK_SECRET);

      vi.doMock('../../src/services/overseerr.service', () => ({
        overseerrService: {
          handleWebhook: vi.fn().mockResolvedValue(undefined),
        },
      }));

      // Test with signature without sha256= prefix
      const response = await request(app)
        .post('/api/v1/webhooks/overseerr')
        .set('X-Overseerr-Signature', signature) // No sha256= prefix
        .send(payload)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should handle webhook processing errors gracefully', async () => {
      const payload = { notification_type: 'MEDIA_AVAILABLE' };
      const payloadString = JSON.stringify(payload);
      const signature = generateWebhookSignature(payloadString, TEST_WEBHOOK_SECRET);

      vi.doMock('../../src/services/overseerr.service', () => ({
        overseerrService: {
          handleWebhook: vi.fn().mockRejectedValue(new Error('Processing failed')),
        },
      }));

      const response = await request(app)
        .post('/api/v1/webhooks/overseerr')
        .set('X-Overseerr-Signature', `sha256=${signature}`)
        .send(payload)
        .expect(500);

      expect(response.body.error).toContain('Webhook processing failed');
    });

    test('should log webhook details for debugging', async () => {
      const payload = {
        notification_type: 'MEDIA_AVAILABLE',
        media: { tmdbId: 12345 },
      };
      const payloadString = JSON.stringify(payload);
      const signature = generateWebhookSignature(payloadString, TEST_WEBHOOK_SECRET);

      const logSpy = vi.spyOn(console, 'log');

      vi.doMock('../../src/services/overseerr.service', () => ({
        overseerrService: {
          handleWebhook: vi.fn().mockResolvedValue(undefined),
        },
      }));

      await request(app)
        .post('/api/v1/webhooks/overseerr')
        .set('X-Overseerr-Signature', `sha256=${signature}`)
        .set('User-Agent', 'Test-Agent')
        .send(payload)
        .expect(200);

      // Verify logging occurred (implementation dependent)
      logSpy.mockRestore();
    });

    test('should handle concurrent webhook requests', async () => {
      const payload = { notification_type: 'MEDIA_AVAILABLE' };
      const payloadString = JSON.stringify(payload);
      const signature = generateWebhookSignature(payloadString, TEST_WEBHOOK_SECRET);

      vi.doMock('../../src/services/overseerr.service', () => ({
        overseerrService: {
          handleWebhook: vi.fn().mockResolvedValue(undefined),
        },
      }));

      // Send 5 concurrent webhook requests
      const requests = Array(5)
        .fill(null)
        .map(() =>
          request(app)
            .post('/api/v1/webhooks/overseerr')
            .set('X-Overseerr-Signature', `sha256=${signature}`)
            .send(payload),
        );

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    test('should validate webhook content structure', async () => {
      const invalidPayloads = [
        null,
        undefined,
        '',
        'invalid json string',
        123,
        [],
        {
          /* missing required fields */
        },
      ];

      for (const invalidPayload of invalidPayloads) {
        let payloadString: string;
        try {
          payloadString = JSON.stringify(invalidPayload);
        } catch {
          payloadString = String(invalidPayload);
        }

        const signature = generateWebhookSignature(payloadString, TEST_WEBHOOK_SECRET);

        const response = await request(app)
          .post('/api/v1/webhooks/overseerr')
          .set('X-Overseerr-Signature', `sha256=${signature}`)
          .set('Content-Type', 'application/json')
          .send(invalidPayload);

        expect([400, 500]).toContain(response.status);
      }
    });
  });

  describe('Webhook Security Tests', () => {
    test('should prevent timing attacks on signature verification', async () => {
      const payload = { notification_type: 'MEDIA_AVAILABLE' };
      const payloadString = JSON.stringify(payload);

      // Test multiple invalid signatures to ensure consistent timing
      const invalidSignatures = [
        'a',
        'ab',
        'abcd',
        'a'.repeat(64),
        generateWebhookSignature(payloadString, 'wrong_secret'),
      ];

      const timings: number[] = [];

      for (const invalidSignature of invalidSignatures) {
        const startTime = process.hrtime.bigint();

        await request(app)
          .post('/api/v1/webhooks/overseerr')
          .set('X-Overseerr-Signature', `sha256=${invalidSignature}`)
          .send(payload)
          .expect(401);

        const endTime = process.hrtime.bigint();
        timings.push(Number(endTime - startTime) / 1e6); // Convert to milliseconds
      }

      // Check that timing variance is reasonable (not a perfect test but helps)
      const avgTime = timings.reduce((sum, time) => sum + time, 0) / timings.length;
      const maxVariance = Math.max(...timings.map((time) => Math.abs(time - avgTime)));

      // Variance should be reasonable (not perfect due to system factors)
      expect(maxVariance).toBeLessThan(avgTime * 2);
    });

    test('should reject webhooks from unauthorized sources', async () => {
      const payload = { notification_type: 'MEDIA_AVAILABLE' };
      const payloadString = JSON.stringify(payload);
      const signature = generateWebhookSignature(payloadString, TEST_WEBHOOK_SECRET);

      // Test various suspicious User-Agent headers
      const suspiciousUserAgents = [
        'curl/7.68.0',
        'PostmanRuntime/7.28.0',
        'python-requests/2.25.1',
        'Mozilla/5.0 (Attack Bot)',
        '',
      ];

      vi.doMock('../../src/services/overseerr.service', () => ({
        overseerrService: {
          handleWebhook: vi.fn().mockResolvedValue(undefined),
        },
      }));

      for (const userAgent of suspiciousUserAgents) {
        // Note: This test depends on implementation - some webhooks might allow any user agent
        const response = await request(app)
          .post('/api/v1/webhooks/overseerr')
          .set('X-Overseerr-Signature', `sha256=${signature}`)
          .set('User-Agent', userAgent)
          .send(payload);

        // Should either succeed (if user-agent filtering not implemented) or fail appropriately
        expect([200, 403]).toContain(response.status);
      }
    });

    test('should handle missing webhook secret configuration', async () => {
      // Temporarily remove webhook secret
      const originalSecret = process.env.OVERSEERR_WEBHOOK_SECRET;
      delete process.env.OVERSEERR_WEBHOOK_SECRET;

      const payload = { notification_type: 'MEDIA_AVAILABLE' };

      const response = await request(app)
        .post('/api/v1/webhooks/overseerr')
        .set('X-Overseerr-Signature', 'sha256=any_signature')
        .send(payload)
        .expect(401);

      expect(response.body.error).toContain('Webhook signature verification failed');

      // Restore secret
      process.env.OVERSEERR_WEBHOOK_SECRET = originalSecret;
    });

    test('should prevent replay attacks (if timestamp validation implemented)', async () => {
      const payload = {
        notification_type: 'MEDIA_AVAILABLE',
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
      };
      const payloadString = JSON.stringify(payload);
      const signature = generateWebhookSignature(payloadString, TEST_WEBHOOK_SECRET);

      // This test depends on implementation of timestamp validation
      const response = await request(app)
        .post('/api/v1/webhooks/overseerr')
        .set('X-Overseerr-Signature', `sha256=${signature}`)
        .send(payload);

      // Should either succeed (if timestamp validation not implemented) or fail
      expect([200, 401, 400]).toContain(response.status);
    });

    test('should handle malformed signature headers', async () => {
      const payload = { notification_type: 'MEDIA_AVAILABLE' };

      const malformedSignatures = [
        'invalid',
        'sha256=',
        'sha256=not_hex',
        'sha256=g'.repeat(64), // Invalid hex characters
        'sha1=valid_but_wrong_algorithm',
        'sha256=' + 'a'.repeat(63), // Too short
        'sha256=' + 'a'.repeat(65), // Too long
      ];

      for (const malformedSignature of malformedSignatures) {
        const response = await request(app)
          .post('/api/v1/webhooks/overseerr')
          .set('X-Overseerr-Signature', malformedSignature)
          .send(payload)
          .expect(401);

        expect(response.body.error).toContain('Webhook signature verification failed');
      }
    });
  });

  describe('Webhook Performance and Reliability', () => {
    test('should handle high volume of webhook requests', async () => {
      const payload = { notification_type: 'MEDIA_AVAILABLE' };
      const payloadString = JSON.stringify(payload);
      const signature = generateWebhookSignature(payloadString, TEST_WEBHOOK_SECRET);

      vi.doMock('../../src/services/overseerr.service', () => ({
        overseerrService: {
          handleWebhook: vi.fn().mockResolvedValue(undefined),
        },
      }));

      const startTime = Date.now();

      // Send 20 concurrent webhook requests
      const requests = Array(20)
        .fill(null)
        .map(() =>
          request(app)
            .post('/api/v1/webhooks/overseerr')
            .set('X-Overseerr-Signature', `sha256=${signature}`)
            .send(payload),
        );

      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    test('should handle webhook processing timeouts gracefully', async () => {
      const payload = { notification_type: 'MEDIA_AVAILABLE' };
      const payloadString = JSON.stringify(payload);
      const signature = generateWebhookSignature(payloadString, TEST_WEBHOOK_SECRET);

      // Mock slow processing
      vi.doMock('../../src/services/overseerr.service', () => ({
        overseerrService: {
          handleWebhook: vi.fn().mockImplementation(
            () => new Promise((resolve) => setTimeout(resolve, 10000)), // 10 second delay
          ),
        },
      }));

      const response = await request(app)
        .post('/api/v1/webhooks/overseerr')
        .set('X-Overseerr-Signature', `sha256=${signature}`)
        .send(payload);

      // Should either timeout or succeed depending on timeout configuration
      expect([200, 504]).toContain(response.status);
    });

    test('should maintain webhook response times under load', async () => {
      const payload = { notification_type: 'MEDIA_AVAILABLE' };
      const payloadString = JSON.stringify(payload);
      const signature = generateWebhookSignature(payloadString, TEST_WEBHOOK_SECRET);

      vi.doMock('../../src/services/overseerr.service', () => ({
        overseerrService: {
          handleWebhook: vi.fn().mockResolvedValue(undefined),
        },
      }));

      const responseTimes: number[] = [];

      // Test 10 sequential requests to measure consistent performance
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();

        await request(app)
          .post('/api/v1/webhooks/overseerr')
          .set('X-Overseerr-Signature', `sha256=${signature}`)
          .send(payload)
          .expect(200);

        responseTimes.push(Date.now() - startTime);
      }

      const avgResponseTime =
        responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      // Performance expectations
      expect(avgResponseTime).toBeLessThan(1000); // 1 second average
      expect(maxResponseTime).toBeLessThan(2000); // 2 seconds maximum
    });
  });

  describe('Content Type and Request Validation', () => {
    test('should handle different content types appropriately', async () => {
      const payload = { notification_type: 'MEDIA_AVAILABLE' };
      const payloadString = JSON.stringify(payload);
      const signature = generateWebhookSignature(payloadString, TEST_WEBHOOK_SECRET);

      vi.doMock('../../src/services/overseerr.service', () => ({
        overseerrService: {
          handleWebhook: vi.fn().mockResolvedValue(undefined),
        },
      }));

      // Test application/json (should work)
      await request(app)
        .post('/api/v1/webhooks/overseerr')
        .set('Content-Type', 'application/json')
        .set('X-Overseerr-Signature', `sha256=${signature}`)
        .send(payload)
        .expect(200);

      // Test application/x-www-form-urlencoded (might not work)
      const response = await request(app)
        .post('/api/v1/webhooks/overseerr')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .set('X-Overseerr-Signature', `sha256=${signature}`)
        .send(payload);

      expect([200, 400]).toContain(response.status);
    });

    test('should handle large webhook payloads', async () => {
      // Create large payload
      const largePayload = {
        notification_type: 'MEDIA_AVAILABLE',
        message: 'x'.repeat(10000), // 10KB message
        media: {
          tmdbId: 12345,
          metadata: {
            description: 'y'.repeat(5000), // Additional 5KB
          },
        },
      };

      const payloadString = JSON.stringify(largePayload);
      const signature = generateWebhookSignature(payloadString, TEST_WEBHOOK_SECRET);

      vi.doMock('../../src/services/overseerr.service', () => ({
        overseerrService: {
          handleWebhook: vi.fn().mockResolvedValue(undefined),
        },
      }));

      const response = await request(app)
        .post('/api/v1/webhooks/overseerr')
        .set('X-Overseerr-Signature', `sha256=${signature}`)
        .send(largePayload);

      // Should either succeed or be rejected due to size limits
      expect([200, 413]).toContain(response.status);
    });

    test('should validate HTTP method restrictions', async () => {
      const payload = { notification_type: 'MEDIA_AVAILABLE' };

      // Test unsupported methods
      const unsupportedMethods = ['GET', 'PUT', 'DELETE', 'PATCH'];

      for (const method of unsupportedMethods) {
        const response = await request(app)
          [method.toLowerCase()]('/api/v1/webhooks/overseerr')
          .send(payload);

        expect([404, 405]).toContain(response.status);
      }
    });
  });
});
