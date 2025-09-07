/**
 * E2E Test Utilities for MediaNest
 * Provides helpers for comprehensive end-to-end testing workflows
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { Application } from 'express';
import { app } from '@/app';
import { prisma } from '@/db/prisma';
import { databaseCleanup } from '../../helpers/database-cleanup';
import { createAuthToken } from '../../helpers/auth';
import { testUsers } from '../../fixtures/test-data';
import { RequestStatus, createMockRequest } from '../fixtures/media-data';

export interface E2ETestUser {
  id: number;
  plexId: string;
  plexUsername: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'inactive';
  token: string;
}

export interface E2ETestContext {
  app: Application;
  users: {
    user: E2ETestUser;
    admin: E2ETestUser;
    secondUser?: E2ETestUser;
  };
  cleanup: () => Promise<void>;
}

/**
 * Setup comprehensive E2E test environment
 */
export async function setupE2EEnvironment(): Promise<E2ETestContext> {
  await databaseCleanup.cleanAll();

  // Create test users
  const testUser = await prisma.user.create({
    data: {
      plexId: testUsers[0].plexId,
      plexUsername: testUsers[0].username,
      email: testUsers[0].email,
      role: testUsers[0].role,
      status: testUsers[0].status,
      plexToken: 'encrypted-token',
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      plexId: testUsers[1].plexId,
      plexUsername: testUsers[1].username,
      email: testUsers[1].email,
      role: testUsers[1].role,
      status: testUsers[1].status,
      plexToken: 'encrypted-admin-token',
    },
  });

  return {
    app,
    users: {
      user: {
        ...testUser,
        token: createAuthToken(testUser)
      },
      admin: {
        ...adminUser,
        token: createAuthToken(adminUser)
      }
    },
    cleanup: async () => {
      await databaseCleanup.cleanAll();
      await prisma.$disconnect();
    }
  };
}

/**
 * Create additional test user for multi-user scenarios
 */
export async function createAdditionalTestUser(context: E2ETestContext): Promise<E2ETestUser> {
  const secondUser = await prisma.user.create({
    data: {
      plexId: 'second-user-plex-id',
      plexUsername: 'seconduser',
      email: 'second@example.com',
      role: 'user',
      status: 'active',
      plexToken: 'encrypted-second-token',
    },
  });

  const userWithToken = {
    ...secondUser,
    token: createAuthToken(secondUser)
  };

  context.users.secondUser = userWithToken;
  return userWithToken;
}

/**
 * Create test media requests with various statuses
 */
export async function createTestRequests(userId: number, count: number = 5) {
  const statuses: RequestStatus[] = ['pending', 'approved', 'processing', 'available', 'declined'];
  const requests = [];

  for (let i = 0; i < count; i++) {
    const request = await prisma.mediaRequest.create({
      data: {
        userId,
        title: `Test ${i % 2 === 0 ? 'Movie' : 'Show'} ${i + 1}`,
        mediaType: i % 2 === 0 ? 'movie' : 'tv',
        tmdbId: `${10000 + i}`,
        status: statuses[i % statuses.length],
        requestedAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)), // Stagger dates
      },
    });
    requests.push(request);
  }

  return requests;
}

/**
 * Visual regression test helper (simulated for API testing)
 */
export interface VisualTestConfig {
  name: string;
  threshold: number;
  fullPage?: boolean;
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class VisualRegression {
  static async compareResponse(
    response: any,
    config: VisualTestConfig
  ): Promise<{ match: boolean; diff?: number }> {
    // Simulate visual regression testing for API responses
    // In a real implementation, this would compare response structure,
    // data completeness, and format consistency
    
    const responseStructure = this.analyzeResponseStructure(response);
    const expectedStructure = await this.getExpectedStructure(config.name);
    
    const similarity = this.calculateSimilarity(responseStructure, expectedStructure);
    const match = similarity >= config.threshold;
    
    return {
      match,
      diff: match ? undefined : (1 - similarity) * 100
    };
  }

  private static analyzeResponseStructure(response: any): any {
    return {
      hasSuccess: typeof response.body?.success === 'boolean',
      hasData: response.body?.data !== undefined,
      hasError: response.body?.error !== undefined,
      statusCode: response.status,
      dataType: Array.isArray(response.body?.data) ? 'array' : typeof response.body?.data,
      keysCount: response.body?.data ? Object.keys(response.body.data).length : 0
    };
  }

  private static async getExpectedStructure(name: string): Promise<any> {
    // In a real implementation, this would load from a baseline file
    return {
      hasSuccess: true,
      hasData: true,
      hasError: false,
      statusCode: 200,
      dataType: 'object',
      keysCount: 5
    };
  }

  private static calculateSimilarity(actual: any, expected: any): number {
    let matches = 0;
    let total = 0;
    
    for (const key in expected) {
      total++;
      if (actual[key] === expected[key]) {
        matches++;
      }
    }
    
    return total > 0 ? matches / total : 0;
  }
}

/**
 * Responsive behavior test helper
 */
export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
  userAgent?: string;
}

export const viewports: ViewportConfig[] = [
  {
    name: 'mobile',
    width: 375,
    height: 667,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)'
  },
  {
    name: 'tablet',
    width: 768,
    height: 1024,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X)'
  },
  {
    name: 'desktop',
    width: 1920,
    height: 1080,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
];

export class ResponsiveTestHelper {
  static async testAcrossViewports<T>(
    testFunction: (viewport: ViewportConfig) => Promise<T>,
    viewports: ViewportConfig[] = viewports
  ): Promise<Record<string, T>> {
    const results: Record<string, T> = {};
    
    for (const viewport of viewports) {
      results[viewport.name] = await testFunction(viewport);
    }
    
    return results;
  }

  static validateResponseForViewport(response: any, viewport: ViewportConfig): boolean {
    // Validate that response is appropriate for the viewport
    // This could check data pagination, content filtering, etc.
    
    if (viewport.name === 'mobile') {
      // Mobile should have smaller page sizes
      if (response.body?.data?.requests?.length > 10) {
        return false;
      }
    }
    
    if (viewport.name === 'desktop') {
      // Desktop can handle larger data sets
      if (response.body?.data?.requests?.length > 50) {
        return false;
      }
    }
    
    return true;
  }
}

/**
 * Performance test helper for E2E scenarios
 */
export class PerformanceTestHelper {
  static async measureResponseTime(testFunction: () => Promise<any>): Promise<{
    response: any;
    duration: number;
  }> {
    const startTime = process.hrtime.bigint();
    const response = await testFunction();
    const endTime = process.hrtime.bigint();
    
    const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
    
    return { response, duration };
  }

  static async loadTest(
    testFunction: () => Promise<any>,
    concurrency: number = 10,
    iterations: number = 100
  ): Promise<{
    avgResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    successRate: number;
    totalRequests: number;
  }> {
    const results: number[] = [];
    let successCount = 0;
    
    const batches = Math.ceil(iterations / concurrency);
    
    for (let batch = 0; batch < batches; batch++) {
      const batchPromises: Promise<any>[] = [];
      const batchSize = Math.min(concurrency, iterations - batch * concurrency);
      
      for (let i = 0; i < batchSize; i++) {
        batchPromises.push(
          this.measureResponseTime(testFunction).then(
            (result) => {
              successCount++;
              results.push(result.duration);
              return result;
            },
            (error) => {
              results.push(Infinity); // Mark as failed
              throw error;
            }
          ).catch(() => {
            // Swallow errors for load testing
          })
        );
      }
      
      await Promise.allSettled(batchPromises);
    }
    
    const validResults = results.filter(time => time !== Infinity);
    
    return {
      avgResponseTime: validResults.reduce((a, b) => a + b, 0) / validResults.length || 0,
      minResponseTime: Math.min(...validResults) || 0,
      maxResponseTime: Math.max(...validResults) || 0,
      successRate: (successCount / iterations) * 100,
      totalRequests: iterations
    };
  }
}

/**
 * Data validation helper for E2E tests
 */
export class DataValidationHelper {
  static validateMediaSearchResponse(response: any): boolean {
    const body = response.body;
    
    return !!(
      body?.success &&
      Array.isArray(body.data) &&
      body.data.every((item: any) => 
        typeof item.id === 'number' &&
        typeof item.title === 'string' &&
        ['movie', 'tv'].includes(item.mediaType)
      ) &&
      body.meta?.query &&
      typeof body.meta.page === 'number'
    );
  }

  static validateMediaDetailsResponse(response: any): boolean {
    const data = response.body?.data;
    
    return !!(
      response.body?.success &&
      data &&
      typeof data.id === 'number' &&
      typeof data.title === 'string' &&
      typeof data.overview === 'string' &&
      typeof data.releaseDate === 'string'
    );
  }

  static validateRequestResponse(response: any): boolean {
    const data = response.body?.data;
    
    return !!(
      response.body?.success &&
      data &&
      typeof data.id === 'number' &&
      typeof data.status === 'number' &&
      data.media?.id &&
      data.requestedBy?.id
    );
  }

  static validateRequestListResponse(response: any): boolean {
    const data = response.body?.data;
    
    return !!(
      response.body?.success &&
      data &&
      Array.isArray(data.requests) &&
      typeof data.totalCount === 'number' &&
      typeof data.currentPage === 'number' &&
      typeof data.totalPages === 'number'
    );
  }
}

/**
 * Test scenario builder for complex workflows
 */
export class ScenarioBuilder {
  private steps: Array<() => Promise<any>> = [];
  private context: any = {};

  step(name: string, fn: (context: any) => Promise<any>): this {
    this.steps.push(async () => {
      const result = await fn(this.context);
      this.context[name] = result;
      return result;
    });
    return this;
  }

  async execute(): Promise<any> {
    for (const step of this.steps) {
      await step();
    }
    return this.context;
  }

  getContext(): any {
    return { ...this.context };
  }
}

/**
 * Mock external service responses for E2E tests
 */
export const mockExternalResponses = {
  tmdb: {
    search: (query: string, mediaType?: string) => ({
      page: 1,
      results: [
        {
          id: 550,
          title: `${query} Result`,
          overview: `Test overview for ${query}`,
          release_date: '2023-01-01',
          media_type: mediaType || 'movie'
        }
      ],
      total_pages: 1,
      total_results: 1
    }),
    
    details: (id: number, mediaType: string = 'movie') => ({
      id,
      title: `Test ${mediaType} ${id}`,
      overview: `Test overview for ${mediaType} ${id}`,
      release_date: '2023-01-01',
      genres: [{ id: 1, name: 'Action' }],
      runtime: 120,
      vote_average: 8.5,
      vote_count: 1000
    })
  },

  plex: {
    libraries: () => ({
      MediaContainer: {
        Directory: [
          { key: '1', title: 'Movies', type: 'movie' },
          { key: '2', title: 'TV Shows', type: 'show' }
        ]
      }
    }),
    
    library: (sectionId: string) => ({
      MediaContainer: {
        Metadata: [
          {
            ratingKey: `${sectionId}001`,
            title: `Test Content ${sectionId}`,
            type: sectionId === '1' ? 'movie' : 'show',
            year: 2023
          }
        ]
      }
    })
  }
};