/**
 * PERFORMANCE AND LOAD TESTING
 * 
 * Comprehensive performance testing for production readiness validation
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../../src/server';
import { AuthTestHelper } from '../helpers/auth-test-helper';

let app: any;
let server: any;
let authHelper: AuthTestHelper;

describe('Performance and Load Testing', () => {
  beforeAll(async () => {
    authHelper = new AuthTestHelper();
    app = await createServer();
    server = app.listen(0);
  });

  afterAll(async () => {
    await server?.close();
    await authHelper.disconnect();
  });

  describe('API Response Time Benchmarks', () => {
    test('authentication endpoints should respond within 200ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'password123'
        });
      
      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(200);
      expect(response.status).toBe(401); // Expected failure for nonexistent user
    });

    test('dashboard endpoints should respond within 300ms under normal load', async () => {
      const user = await authHelper.createTestUser();
      const accessToken = await authHelper.generateAccessToken(user.id);
      
      const responseTimes: number[] = [];
      
      // Test 10 consecutive requests
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        
        const response = await request(app)
          .get('/api/v1/dashboard/stats')
          .set('Authorization', `Bearer ${accessToken}`);
        
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);
        
        expect(response.status).toBe(200);
      }
      
      const averageTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const maxTime = Math.max(...responseTimes);
      
      expect(averageTime).toBeLessThan(300);
      expect(maxTime).toBeLessThan(500);
    });

    test('media search should handle large result sets efficiently', async () => {
      const user = await authHelper.createTestUser();
      const accessToken = await authHelper.generateAccessToken(user.id);
      
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'movie', limit: 100 })
        .set('Authorization', `Bearer ${accessToken}`);
      
      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(1000); // 1 second max for search
      expect(response.status).toBe(200);
    });
  });

  describe('Concurrent User Simulation', () => {
    test('should handle 50 concurrent users without degradation', async () => {
      // Create 50 test users
      const users = await Promise.all(
        Array(50).fill(null).map(() => authHelper.createTestUser())
      );
      
      const tokens = await Promise.all(
        users.map(user => authHelper.generateAccessToken(user.id))
      );
      
      const startTime = Date.now();
      
      // Simulate concurrent dashboard requests
      const concurrentRequests = tokens.map(token =>
        request(app)
          .get('/api/v1/dashboard/stats')
          .set('Authorization', `Bearer ${token}`)
      );
      
      const responses = await Promise.all(concurrentRequests);
      const totalTime = Date.now() - startTime;
      
      // All requests should succeed
      const successfulResponses = responses.filter(res => res.status === 200);
      expect(successfulResponses.length).toBe(50);
      
      // Should complete within reasonable time (50 requests in under 10 seconds)
      expect(totalTime).toBeLessThan(10000);
      
      // Calculate average response time
      const averageTime = totalTime / 50;
      expect(averageTime).toBeLessThan(200); // 200ms average per request
    });

    test('should maintain stability under sustained load', async () => {
      const user = await authHelper.createTestUser();
      const accessToken = await authHelper.generateAccessToken(user.id);
      
      const testDuration = 30000; // 30 seconds
      const requestInterval = 100; // Request every 100ms
      const startTime = Date.now();
      
      const responseTimes: number[] = [];
      const errors: number[] = [];
      
      while (Date.now() - startTime < testDuration) {
        const requestStart = Date.now();
        
        try {
          const response = await request(app)
            .get('/api/v1/dashboard/stats')
            .set('Authorization', `Bearer ${accessToken}`);
          
          const requestTime = Date.now() - requestStart;
          responseTimes.push(requestTime);
          
          if (response.status !== 200) {
            errors.push(response.status);
          }
          
          // Wait for next request
          const elapsed = Date.now() - requestStart;
          if (elapsed < requestInterval) {
            await new Promise(resolve => setTimeout(resolve, requestInterval - elapsed));
          }
        } catch (error) {
          errors.push(500);
        }
      }
      
      // Performance assertions
      const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const errorRate = errors.length / responseTimes.length;
      
      expect(averageResponseTime).toBeLessThan(500); // 500ms average
      expect(errorRate).toBeLessThan(0.05); // Less than 5% error rate
      expect(responseTimes.length).toBeGreaterThan(200); // Should have made many requests
    });
  });

  describe('Memory and Resource Usage', () => {
    test('should not leak memory during repeated operations', async () => {
      const user = await authHelper.createTestUser();
      const accessToken = await authHelper.generateAccessToken(user.id);
      
      const initialMemory = process.memoryUsage();
      
      // Perform 1000 operations
      for (let i = 0; i < 1000; i++) {
        await request(app)
          .get('/api/v1/dashboard/stats')
          .set('Authorization', `Bearer ${accessToken}`);
          
        // Force garbage collection occasionally
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage();
      
      // Memory growth should be reasonable (less than 100MB increase)
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // 100MB
    });

    test('should handle large payload requests efficiently', async () => {
      const user = await authHelper.createTestUser();
      const accessToken = await authHelper.generateAccessToken(user.id);
      
      // Create a large but valid request payload
      const largeMediaRequest = {
        title: 'A'.repeat(1000), // Large title
        description: 'B'.repeat(5000), // Large description
        year: 2023,
        type: 'movie',
        imdbId: 'tt1234567',
        tmdbId: 123456,
        genres: Array(50).fill('Action'), // Large array
        cast: Array(100).fill('Actor Name'), // Large cast array
      };
      
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/v1/media/request')
        .send(largeMediaRequest)
        .set('Authorization', `Bearer ${accessToken}`);
      
      const responseTime = Date.now() - startTime;
      
      // Should handle large payloads within reasonable time
      expect(responseTime).toBeLessThan(2000); // 2 seconds max
      
      // Response should indicate validation error for overly large data
      expect([400, 413, 422].includes(response.status)).toBe(true);
    });
  });

  describe('Database Performance Under Load', () => {
    test('should maintain query performance with concurrent database operations', async () => {
      const users = await Promise.all(
        Array(20).fill(null).map(() => authHelper.createTestUser())
      );
      
      const tokens = await Promise.all(
        users.map(user => authHelper.generateAccessToken(user.id))
      );
      
      // Create concurrent media requests (write operations)
      const writeOperations = tokens.map((token, index) =>
        request(app)
          .post('/api/v1/media/request')
          .send({
            title: `Concurrent Movie ${index}`,
            year: 2023,
            type: 'movie',
            imdbId: `tt12345${String(index).padStart(2, '0')}`,
            tmdbId: 123450 + index
          })
          .set('Authorization', `Bearer ${token}`)
      );
      
      // Mix with read operations
      const readOperations = tokens.map(token =>
        request(app)
          .get('/api/v1/media/requests')
          .set('Authorization', `Bearer ${token}`)
      );
      
      const startTime = Date.now();
      
      // Execute all operations concurrently
      const allOperations = [...writeOperations, ...readOperations];
      const results = await Promise.allSettled(allOperations);
      
      const totalTime = Date.now() - startTime;
      
      // Most operations should succeed
      const successful = results.filter(
        (result): result is PromiseFulfilledResult<any> => 
          result.status === 'fulfilled' && 
          [200, 201].includes(result.value.status)
      );
      
      expect(successful.length).toBeGreaterThan(allOperations.length * 0.9); // 90% success rate
      expect(totalTime).toBeLessThan(5000); // Complete within 5 seconds
    });
  });

  describe('Scaling and Capacity Tests', () => {
    test('should identify performance bottlenecks at scale', async () => {
      const batchSizes = [10, 25, 50, 100];
      const results: Array<{ batchSize: number; avgResponseTime: number; successRate: number }> = [];
      
      for (const batchSize of batchSizes) {
        const users = await Promise.all(
          Array(batchSize).fill(null).map(() => authHelper.createTestUser())
        );
        
        const tokens = await Promise.all(
          users.map(user => authHelper.generateAccessToken(user.id))
        );
        
        const startTime = Date.now();
        
        const requests = tokens.map(token =>
          request(app)
            .get('/api/v1/dashboard/stats')
            .set('Authorization', `Bearer ${token}`)
            .then(res => ({ status: res.status, time: Date.now() - startTime }))
        );
        
        const responses = await Promise.all(requests);
        const totalTime = Date.now() - startTime;
        
        const successfulResponses = responses.filter(r => r.status === 200);
        const avgResponseTime = totalTime / batchSize;
        const successRate = successfulResponses.length / batchSize;
        
        results.push({
          batchSize,
          avgResponseTime,
          successRate
        });
        
        // Cleanup users for next batch
        await authHelper.cleanupTestUsers();
      }
      
      // Analyze scaling characteristics
      expect(results.every(r => r.successRate > 0.95)).toBe(true); // 95% success rate at all scales
      
      // Response time should scale reasonably (not exponentially)
      const smallBatchTime = results.find(r => r.batchSize === 10)!.avgResponseTime;
      const largeBatchTime = results.find(r => r.batchSize === 100)!.avgResponseTime;
      
      // Large batch shouldn't be more than 5x slower than small batch
      expect(largeBatchTime).toBeLessThan(smallBatchTime * 5);
    });
  });
});