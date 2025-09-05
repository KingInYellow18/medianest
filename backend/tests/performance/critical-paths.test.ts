import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { performance } from 'perf_hooks';
import { setupTestApp } from '../helpers/test-app';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { PrismaClient } from '@prisma/client';

describe('Performance Tests - Critical Paths', () => {
  let app: any;
  let prisma: PrismaClient;

  beforeEach(async () => {
    app = setupTestApp();
    prisma = await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(prisma);
  });

  describe('API Response Times', () => {
    it('should respond to health check within 100ms', async () => {
      const start = performance.now();
      
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(100);
      expect(response.body).toBeDefined();
    });

    it('should handle authentication within 500ms', async () => {
      const start = performance.now();
      
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword'
        })
        .expect(401); // Expected failure, but should be fast
      
      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(500);
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 50;
      const requests = Array(concurrentRequests).fill(null).map(() =>
        request(app).get('/api/health')
      );

      const start = performance.now();
      const responses = await Promise.all(requests);
      const end = performance.now();
      const totalDuration = end - start;

      // All requests should complete within 3 seconds
      expect(totalDuration).toBeLessThan(3000);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should maintain performance under load', async () => {
      const rounds = 5;
      const requestsPerRound = 20;
      const durations: number[] = [];

      for (let round = 0; round < rounds; round++) {
        const requests = Array(requestsPerRound).fill(null).map(() =>
          request(app).get('/api/health')
        );

        const start = performance.now();
        await Promise.all(requests);
        const end = performance.now();
        
        durations.push(end - start);
      }

      // Performance should not degrade significantly across rounds
      const firstRoundDuration = durations[0];
      const lastRoundDuration = durations[durations.length - 1];
      const degradationRatio = lastRoundDuration / firstRoundDuration;

      expect(degradationRatio).toBeLessThan(2.0); // Less than 2x slower
    });
  });

  describe('Database Performance', () => {
    it('should handle database queries within acceptable time', async () => {
      // Create test data
      for (let i = 0; i < 100; i++) {
        await prisma.user.create({
          data: {
            id: `perf-user-${i}`,
            plexId: `perf-plex-${i}`,
            username: `perfuser${i}`,
            email: `perf${i}@example.com`,
            role: 'user',
            status: 'active'
          }
        });
      }

      const start = performance.now();
      
      const users = await prisma.user.findMany({
        where: { status: 'active' },
        take: 20,
        orderBy: { createdAt: 'desc' }
      });
      
      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(200); // Should complete within 200ms
      expect(users).toHaveLength(20);
    });

    it('should handle complex queries efficiently', async () => {
      // Create test data with relationships
      const user = await prisma.user.create({
        data: {
          id: 'complex-user',
          plexId: 'complex-plex',
          username: 'complexuser',
          email: 'complex@example.com',
          role: 'user',
          status: 'active'
        }
      });

      for (let i = 0; i < 50; i++) {
        await prisma.youtubeDownload.create({
          data: {
            userId: user.id,
            playlistUrl: `https://youtube.com/playlist?list=PL${i}`,
            playlistTitle: `Playlist ${i}`,
            status: i % 3 === 0 ? 'completed' : 'queued'
          }
        });
      }

      const start = performance.now();
      
      const result = await prisma.user.findUnique({
        where: { id: 'complex-user' },
        include: {
          youtubeDownloads: {
            where: { status: 'completed' },
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      });
      
      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(300);
      expect(result?.youtubeDownloads).toBeDefined();
      expect(result?.youtubeDownloads.length).toBeGreaterThan(0);
    });

    it('should handle pagination efficiently', async () => {
      // Create large dataset
      for (let i = 0; i < 1000; i++) {
        await prisma.serviceStatus.create({
          data: {
            serviceName: `service-${i}`,
            status: i % 2 === 0 ? 'operational' : 'degraded',
            lastChecked: new Date(),
            responseTime: Math.floor(Math.random() * 1000)
          }
        });
      }

      const start = performance.now();
      
      const page1 = await prisma.serviceStatus.findMany({
        skip: 0,
        take: 25,
        orderBy: { lastChecked: 'desc' }
      });

      const page10 = await prisma.serviceStatus.findMany({
        skip: 225, // Page 10
        take: 25,
        orderBy: { lastChecked: 'desc' }
      });
      
      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(400);
      expect(page1).toHaveLength(25);
      expect(page10).toHaveLength(25);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during repeated operations', async () => {
      const iterations = 100;
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        await request(app)
          .get('/api/health')
          .expect(200);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle large payloads efficiently', async () => {
      const largeData = Array(10000).fill('x').join('');
      const initialMemory = process.memoryUsage().heapUsed;

      await request(app)
        .post('/api/test-large-payload')
        .send({ data: largeData })
        .expect(404); // Endpoint doesn't exist, but should handle payload

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Should not significantly increase memory
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle errors quickly without performance degradation', async () => {
      const start = performance.now();
      
      // Generate multiple 404 errors
      const errorRequests = Array(20).fill(null).map(() =>
        request(app)
          .get('/api/non-existent-endpoint')
          .expect(404)
      );

      await Promise.all(errorRequests);
      
      const end = performance.now();
      const duration = end - start;

      // Error handling should be fast
      expect(duration).toBeLessThan(1000);
    });

    it('should recover quickly from database errors', async () => {
      // Simulate database error scenario
      const start = performance.now();
      
      try {
        // This should fail gracefully
        await prisma.user.findUnique({
          where: { id: null as any } // Invalid query
        });
      } catch (error) {
        // Expected error
      }

      // Verify database is still responsive
      const users = await prisma.user.findMany({ take: 1 });
      
      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(200);
    });
  });

  describe('Stress Testing', () => {
    it('should handle burst traffic', async () => {
      const burstSize = 100;
      const maxAcceptableFailures = 5; // 5% failure rate acceptable under stress
      
      const requests = Array(burstSize).fill(null).map((_, index) =>
        request(app)
          .get(`/api/health?id=${index}`)
      );

      const start = performance.now();
      const results = await Promise.allSettled(requests);
      const end = performance.now();
      const duration = end - start;

      const failures = results.filter(result => result.status === 'rejected').length;
      const successRate = ((burstSize - failures) / burstSize) * 100;

      expect(failures).toBeLessThanOrEqual(maxAcceptableFailures);
      expect(successRate).toBeGreaterThanOrEqual(95);
      expect(duration).toBeLessThan(5000); // Complete within 5 seconds
    });

    it('should maintain throughput under sustained load', async () => {
      const duration = 2000; // 2 seconds
      const requestInterval = 50; // Request every 50ms
      const expectedRequests = Math.floor(duration / requestInterval);
      
      const requests: Promise<any>[] = [];
      const startTime = performance.now();
      
      const interval = setInterval(() => {
        if (performance.now() - startTime >= duration) {
          clearInterval(interval);
          return;
        }
        
        requests.push(
          request(app)
            .get('/api/health')
            .timeout(1000) // 1 second timeout
        );
      }, requestInterval);

      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, duration + 100));
      
      const results = await Promise.allSettled(requests);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const throughput = (successful / (duration / 1000)); // requests per second

      expect(throughput).toBeGreaterThan(15); // At least 15 RPS
      expect(successful).toBeGreaterThan(expectedRequests * 0.9); // 90% success rate
    });
  });

  describe('Resource Utilization', () => {
    it('should not exceed CPU thresholds during normal operation', async () => {
      const requests = Array(50).fill(null).map(() =>
        request(app).get('/api/health')
      );

      const startCpuUsage = process.cpuUsage();
      await Promise.all(requests);
      const endCpuUsage = process.cpuUsage(startCpuUsage);

      // CPU usage should be reasonable (less than 100ms of CPU time)
      const totalCpuTime = endCpuUsage.user + endCpuUsage.system;
      expect(totalCpuTime).toBeLessThan(100_000); // 100ms in microseconds
    });

    it('should handle file system operations efficiently', async () => {
      const fs = require('fs').promises;
      const path = require('path');
      const testDir = path.join(process.cwd(), 'test-temp');

      try {
        await fs.mkdir(testDir, { recursive: true });

        const start = performance.now();
        
        // Create multiple files
        const filePromises = Array(20).fill(null).map((_, i) =>
          fs.writeFile(
            path.join(testDir, `test-file-${i}.txt`),
            `Test content ${i}`
          )
        );

        await Promise.all(filePromises);

        // Read all files
        const readPromises = Array(20).fill(null).map((_, i) =>
          fs.readFile(path.join(testDir, `test-file-${i}.txt`), 'utf8')
        );

        await Promise.all(readPromises);
        
        const end = performance.now();
        const duration = end - start;

        expect(duration).toBeLessThan(500); // Should complete within 500ms

      } finally {
        // Cleanup
        try {
          await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });
  });
});