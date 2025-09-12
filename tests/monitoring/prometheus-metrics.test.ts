import { describe, it, expect, beforeAll, afterAll } from '@jest/testing-library/jest-dom';
import express from 'express';
import client from 'prom-client';
import request from 'supertest';

import { register, metricsMiddleware } from '../../backend/src/middleware/metrics';


describe('Prometheus Metrics Integration', () => {
  let app: express.Application;

  beforeAll(() => {
    // Reset registry
    register.clear();

    // Create test app
    app = express();
    app.use(metricsMiddleware);

    // Add metrics endpoint
    app.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        const metrics = await register.metrics();
        res.end(metrics);
      } catch (error) {
        res.status(500).json({ error: 'Failed to collect metrics' });
      }
    });

    // Test routes
    app.get('/test', (req, res) => {
      res.json({ message: 'test' });
    });

    app.get('/error', (req, res) => {
      res.status(500).json({ error: 'test error' });
    });
  });

  afterAll(() => {
    register.clear();
  });

  describe('Metrics Endpoint', () => {
    it('should return metrics in Prometheus format', async () => {
      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toBeDefined();
      expect(response.text.length).toBeGreaterThan(0);
    });

    it('should include default Node.js metrics', async () => {
      const response = await request(app).get('/metrics');

      expect(response.text).toMatch(/nodejs_version_info/);
      expect(response.text).toMatch(/process_cpu_user_seconds_total/);
      expect(response.text).toMatch(/process_resident_memory_bytes/);
      expect(response.text).toMatch(/nodejs_heap_size_total_bytes/);
    });

    it('should include custom HTTP metrics after requests', async () => {
      // Make a few test requests to generate metrics
      await request(app).get('/test');
      await request(app).get('/test');
      await request(app).get('/error');

      const response = await request(app).get('/metrics');

      expect(response.text).toMatch(/http_requests_total/);
      expect(response.text).toMatch(/http_request_duration_seconds/);
      expect(response.text).toMatch(/method="GET"/);
      expect(response.text).toMatch(/status_code="200"/);
      expect(response.text).toMatch(/status_code="500"/);
    });
  });

  describe('Metrics Collection', () => {
    it('should collect HTTP request metrics', async () => {
      // Clear metrics first
      register.clear();

      // Re-register metrics
      const httpRequestsTotal = new client.Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code'],
      });
      register.registerMetric(httpRequestsTotal);

      // Make requests
      await request(app).get('/test');
      await request(app).get('/error');

      const metrics = await register.metrics();
      expect(metrics).toMatch(
        /http_requests_total.*method="GET".*route="\/test".*status_code="200"/,
      );
      expect(metrics).toMatch(
        /http_requests_total.*method="GET".*route="\/error".*status_code="500"/,
      );
    });

    it('should collect response time metrics', async () => {
      const response = await request(app).get('/metrics');
      expect(response.text).toMatch(/http_request_duration_seconds_bucket/);
      expect(response.text).toMatch(/http_request_duration_seconds_count/);
      expect(response.text).toMatch(/http_request_duration_seconds_sum/);
    });

    it('should collect request size metrics', async () => {
      await request(app).post('/test').send({ data: 'test request body' });

      const response = await request(app).get('/metrics');
      expect(response.text).toMatch(/http_request_size_bytes/);
    });
  });

  describe('Business Metrics', () => {
    it('should include application info metrics', async () => {
      const response = await request(app).get('/metrics');

      expect(response.text).toMatch(/app_info/);
      expect(response.text).toMatch(/version=/);
      expect(response.text).toMatch(/environment=/);
    });

    it('should include event loop lag metrics', async () => {
      const response = await request(app).get('/metrics');
      expect(response.text).toMatch(/nodejs_eventloop_lag_seconds/);
    });
  });

  describe('Error Handling', () => {
    it('should handle metrics collection errors gracefully', async () => {
      // Mock register.metrics to throw error
      const originalMetrics = register.metrics;
      register.metrics = jest.fn().mockRejectedValue(new Error('Test error'));

      const response = await request(app).get('/metrics');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to collect metrics');

      // Restore original method
      register.metrics = originalMetrics;
    });
  });

  describe('Performance', () => {
    it('should respond to metrics requests quickly', async () => {
      const start = Date.now();
      await request(app).get('/metrics');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should respond in less than 1 second
    });

    it('should handle concurrent metrics requests', async () => {
      const requests = Array(5)
        .fill(null)
        .map(() => request(app).get('/metrics'));
      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.text).toBeDefined();
      });
    });
  });

  describe('Metrics Format Validation', () => {
    it('should return valid Prometheus exposition format', async () => {
      const response = await request(app).get('/metrics');
      const lines = response.text.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        if (line.startsWith('#')) {
          // Comment lines should start with # HELP or # TYPE
          expect(line).toMatch(/^#\s+(HELP|TYPE)\s+/);
        } else if (line.trim()) {
          // Metric lines should have format: metric_name{labels} value
          expect(line).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*(\{[^}]*\})?\s+[0-9.-]+(\s+[0-9]+)?$/);
        }
      }
    });

    it('should have proper metric naming conventions', async () => {
      const response = await request(app).get('/metrics');
      const metricNames = response.text
        .split('\n')
        .filter((line) => !line.startsWith('#') && line.trim())
        .map((line) => line.split(/[\s{]/)[0])
        .filter((name, index, arr) => arr.indexOf(name) === index);

      for (const name of metricNames) {
        // Should follow Prometheus naming conventions
        expect(name).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
        expect(name).not.toMatch(/^[0-9]/); // Should not start with number
      }
    });

    it('should include proper HELP and TYPE metadata', async () => {
      const response = await request(app).get('/metrics');
      const lines = response.text.split('\n');

      const helpLines = lines.filter((line) => line.startsWith('# HELP'));
      const typeLines = lines.filter((line) => line.startsWith('# TYPE'));

      expect(helpLines.length).toBeGreaterThan(0);
      expect(typeLines.length).toBeGreaterThan(0);

      // Each metric should have both HELP and TYPE
      for (const helpLine of helpLines) {
        const metricName = helpLine.split(' ')[2];
        const hasType = typeLines.some((typeLine) => typeLine.includes(metricName));
        expect(hasType).toBe(true);
      }
    });
  });
});
