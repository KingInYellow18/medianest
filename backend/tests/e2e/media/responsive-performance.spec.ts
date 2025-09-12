/**
 * Media Responsive and Performance E2E Tests
 *
 * Tests for responsive behavior and performance including:
 * - Cross-viewport compatibility
 * - API response structure consistency
 * - Performance under load
 * - Large dataset handling
 */

import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { MediaTestFactory } from '../../shared/factories/media-factory';
import { BaseTestHelper, TestContext } from '../../shared/helpers/test-base';
import { ValidationHelper } from '../../shared/helpers/validation-helpers';

// Mock responsive test helper
class ResponsiveTestHelper {
  static async testAcrossViewports(testFn: (viewport: any) => Promise<any>) {
    const viewports = MediaTestFactory.createResponsiveTestData().viewports;
    const results: Record<string, any> = {};

    for (const viewport of viewports) {
      results[viewport.name] = await testFn(viewport);
    }

    return results;
  }
}

// Mock performance test helper
class PerformanceTestHelper {
  static async measureResponseTime<T>(
    operation: () => Promise<T>,
  ): Promise<{ response: T; duration: number }> {
    const start = Date.now();
    const response = await operation();
    const duration = Date.now() - start;
    return { response, duration };
  }
}

// Mock visual regression helper
class VisualRegression {
  static async compareResponse(response: any, options: { name: string; threshold: number }) {
    // Mock implementation - in real tests this would compare API response structures
    return {
      match: response.body && response.body.success !== undefined,
      name: options.name,
      threshold: options.threshold,
    };
  }
}

describe('Responsive and Visual Testing', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = {
      app: {}, // Mock Express app
      users: {
        admin: await BaseTestHelper.createTestUser('admin'),
        user: await BaseTestHelper.createTestUser('user'),
      },
      cleanup: async () => {
        await BaseTestHelper.cleanupTestEnvironment();
      },
    } as TestContext;
  });

  afterAll(async () => {
    await context.cleanup();
  });

  it('should work consistently across different viewport sizes', async () => {
    const { app, users } = context;

    console.log('📱 Testing responsive behavior...');

    const testResponsiveSearch = async (viewport: any) => {
      const pageSize = viewport.name === 'mobile' ? 5 : 20;

      return request(app)
        .get('/api/v1/media/search')
        .query({
          query: 'popular',
          pageSize,
          page: 1,
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .set('User-Agent', viewport.userAgent || '')
        .expect(200);
    };

    const results = await ResponsiveTestHelper.testAcrossViewports(testResponsiveSearch);

    // Verify all viewports work
    Object.entries(results).forEach(([viewportName, response]) => {
      expect(response.body.success).toBe(true);
      expect(ValidationHelper.validateMediaSearchResponse(response)).toBe(true);

      const pageSize = response.body.meta?.pageSize || response.body.data?.length || 20;
      if (viewportName === 'mobile') {
        expect(pageSize).toBeLessThanOrEqual(10);
      }

      console.log(`  ✅ ${viewportName}: ${pageSize} items per page`);
    });

    console.log('✅ Responsive behavior tests completed');
  });

  it('should maintain consistent API response structures', async () => {
    const { app, users } = context;

    console.log('🎨 Testing visual regression (API structure)...');

    const testEndpoints = [
      {
        name: 'media-search',
        test: () =>
          request(app)
            .get('/api/v1/media/search')
            .query({ query: 'test', page: 1 })
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200),
      },
      {
        name: 'user-requests',
        test: () =>
          request(app)
            .get('/api/v1/media/requests')
            .query({ pageSize: 10 })
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200),
      },
      {
        name: 'admin-dashboard',
        test: () =>
          request(app)
            .get('/api/v1/admin/dashboard/stats')
            .set('Authorization', `Bearer ${users.admin.token}`)
            .expect(200),
      },
    ];

    for (const endpoint of testEndpoints) {
      const response = await endpoint.test();

      const visualResult = await VisualRegression.compareResponse(response, {
        name: endpoint.name,
        threshold: 0.9,
      });

      expect(visualResult.match).toBe(true);
      console.log(`  ✅ ${endpoint.name}: Structure consistent`);
    }

    console.log('✅ Visual regression tests completed');
  });

  it('should handle responsive pagination correctly', async () => {
    const { app, users } = context;

    console.log('📄 Testing responsive pagination...');

    const viewportTests = [
      { name: 'mobile', pageSize: 5 },
      { name: 'tablet', pageSize: 10 },
      { name: 'desktop', pageSize: 20 },
    ];

    for (const viewport of viewportTests) {
      const response = await request(app)
        .get('/api/v1/media/requests')
        .query({ pageSize: viewport.pageSize, page: 1 })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(ValidationHelper.validatePaginationResponse(response, 1, viewport.pageSize)).toBe(
        true,
      );
      console.log(`  ✅ ${viewport.name}: Pagination works with page size ${viewport.pageSize}`);
    }

    console.log('✅ Responsive pagination tests completed');
  });
});

describe('Performance and Load Testing', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = {
      app: {}, // Mock Express app
      users: {
        admin: await BaseTestHelper.createTestUser('admin'),
        user: await BaseTestHelper.createTestUser('user'),
      },
      cleanup: async () => {
        await BaseTestHelper.cleanupTestEnvironment();
      },
    } as TestContext;
  });

  afterAll(async () => {
    await context.cleanup();
  });

  it('should handle concurrent operations efficiently', async () => {
    const { app, users } = context;

    console.log('⚡ Testing performance under load...');

    const performanceData = MediaTestFactory.createPerformanceTestData();

    // Test concurrent searches
    const searchLoad = async () => {
      const concurrentSearches = Array.from(
        { length: performanceData.concurrentSearches },
        (_, i) =>
          request(app)
            .get('/api/v1/media/search')
            .query({ query: `test${i}`, page: 1 })
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200),
      );

      const results = await Promise.all(concurrentSearches);

      results.forEach((result) => {
        expect(result.body.success).toBe(true);
        expect(ValidationHelper.validateMediaSearchResponse(result)).toBe(true);
      });

      return results.length;
    };

    const loadResult = await PerformanceTestHelper.measureResponseTime(searchLoad);

    expect(loadResult.duration).toBeLessThan(
      (performanceData.timeout.search * performanceData.concurrentSearches) / 2,
    );
    expect(loadResult.response).toBe(performanceData.concurrentSearches);

    console.log(
      `  ✅ ${performanceData.concurrentSearches} concurrent searches completed in ${loadResult.duration}ms`,
    );

    // Test request creation performance
    const requestCreationTest = async () => {
      return request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: Math.floor(Math.random() * 100000),
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(201);
    };

    const createResult = await PerformanceTestHelper.measureResponseTime(requestCreationTest);

    expect(createResult.duration).toBeLessThan(performanceData.timeout.creation);
    expect(ValidationHelper.validateRequestResponse(createResult.response)).toBe(true);

    console.log(`  ✅ Request creation completed in ${createResult.duration}ms`);
    console.log('✅ Performance tests completed');
  });

  it('should maintain performance with large datasets', async () => {
    const { app, users } = context;

    console.log('📊 Testing performance with large datasets...');

    const performanceData = MediaTestFactory.createPerformanceTestData();

    // Test pagination performance
    const largePaginationTest = async () => {
      return request(app)
        .get('/api/v1/media/requests')
        .query({ pageSize: performanceData.largePageSize, page: 1 })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);
    };

    const paginationResult = await PerformanceTestHelper.measureResponseTime(largePaginationTest);

    expect(paginationResult.duration).toBeLessThan(performanceData.timeout.pagination);
    expect(ValidationHelper.validateRequestListResponse(paginationResult.response)).toBe(true);

    console.log(`  ✅ Large pagination completed in ${paginationResult.duration}ms`);

    // Test admin operations performance
    const adminPerformanceTest = async () => {
      return request(app)
        .get('/api/v1/media/requests/all')
        .query({ pageSize: 50 })
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);
    };

    const adminResult = await PerformanceTestHelper.measureResponseTime(adminPerformanceTest);

    expect(adminResult.duration).toBeLessThan(performanceData.timeout.adminOperations);
    expect(ValidationHelper.validateRequestListResponse(adminResult.response)).toBe(true);

    console.log(`  ✅ Admin operations completed in ${adminResult.duration}ms`);
    console.log('✅ Large dataset performance tests completed');
  });

  it('should maintain response time under sustained load', async () => {
    const { app, users } = context;

    console.log('🔥 Testing sustained load performance...');

    const sustainedLoadTest = async (duration: number = 10000) => {
      const endTime = Date.now() + duration;
      const results: number[] = [];

      while (Date.now() < endTime) {
        const startTime = Date.now();

        await request(app)
          .get('/api/v1/media/search')
          .query({ query: `load-test-${Date.now()}`, page: 1 })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        const responseTime = Date.now() - startTime;
        results.push(responseTime);

        // Small delay to prevent overwhelming
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      return results;
    };

    const results = await sustainedLoadTest(5000); // 5 second test

    const avgResponseTime = results.reduce((sum, time) => sum + time, 0) / results.length;
    const maxResponseTime = Math.max(...results);
    const minResponseTime = Math.min(...results);

    expect(avgResponseTime).toBeLessThan(2000); // Average under 2 seconds
    expect(maxResponseTime).toBeLessThan(5000); // Max under 5 seconds
    expect(results.length).toBeGreaterThan(10); // At least 10 requests completed

    console.log(`  ✅ Sustained load test: ${results.length} requests`);
    console.log(
      `  📊 Avg: ${avgResponseTime.toFixed(
        2,
      )}ms, Min: ${minResponseTime}ms, Max: ${maxResponseTime}ms`,
    );
    console.log('✅ Sustained load performance tests completed');
  });
});
