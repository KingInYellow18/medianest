/**
 * Database Test Helper
 *
 * Provides utilities for database testing including:
 * - Test database setup and teardown
 * - Test data creation and cleanup
 * - Transaction management
 * - Connection error simulation
 * - Performance testing utilities
 */

import { execSync } from 'child_process';

import { PrismaClient } from '@prisma/client';

export interface TestUser {
  id?: string;
  plexId: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'inactive';
  plexToken?: string;
}

export interface TestMediaRequest {
  id?: string;
  userId: string;
  mediaId: string;
  status: 'pending' | 'approved' | 'denied' | 'completed';
  quality: string;
  notes?: string;
}

export class DatabaseTestHelper {
  private prisma: PrismaClient;
  private isConnectionBroken = false;
  private originalDatasource: string;

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
    this.originalDatasource = process.env.DATABASE_URL || '';
  }

  /**
   * Setup test database with schema and initial data
   */
  async setupTestDatabase(): Promise<void> {
    try {
      // Run database migrations
      console.log('📊 Setting up test database schema...');
      execSync('npx prisma migrate reset --force --skip-seed', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
      });

      // Generate Prisma client
      execSync('npx prisma generate', {
        stdio: 'inherit',
      });

      console.log('✅ Test database schema ready');
    } catch (error) {
      console.error('❌ Failed to setup test database:', error);
      throw error;
    }
  }

  /**
   * Create a test user with the specified data
   */
  async createTestUser(userData: TestUser): Promise<any> {
    if (this.isConnectionBroken) {
      throw new Error('Database connection is broken');
    }

    const user = await this.prisma.user.create({
      data: {
        plexId: userData.plexId,
        plexUsername: userData.username,
        email: userData.email,
        role: userData.role,
        status: userData.status,
        plexToken: userData.plexToken || 'encrypted-test-token',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return user;
  }

  /**
   * Create a test media record
   */
  async createTestMedia(mediaData: {
    tmdbId: number;
    mediaType: 'movie' | 'tv';
    title: string;
    overview?: string;
    status?: 'available' | 'unavailable';
  }): Promise<any> {
    if (this.isConnectionBroken) {
      throw new Error('Database connection is broken');
    }

    const media = await this.prisma.media.create({
      data: {
        tmdbId: mediaData.tmdbId,
        mediaType: mediaData.mediaType,
        title: mediaData.title,
        overview: mediaData.overview || 'Test media overview',
        status: mediaData.status || 'available',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return media;
  }

  /**
   * Create a test media request
   */
  async createTestMediaRequest(requestData: TestMediaRequest): Promise<any> {
    if (this.isConnectionBroken) {
      throw new Error('Database connection is broken');
    }

    const request = await this.prisma.mediaRequest.create({
      data: {
        userId: requestData.userId,
        mediaId: requestData.mediaId,
        status: requestData.status,
        quality: requestData.quality,
        notes: requestData.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        user: true,
        media: true,
      },
    });

    return request;
  }

  /**
   * Create test data for a complete workflow
   */
  async createTestWorkflow(): Promise<{
    user: any;
    admin: any;
    media: any;
    request: any;
  }> {
    // Create test user
    const user = await this.createTestUser({
      plexId: 'workflow-test-user',
      username: 'workflowuser',
      email: 'workflow@test.com',
      role: 'user',
      status: 'active',
    });

    // Create test admin
    const admin = await this.createTestUser({
      plexId: 'workflow-test-admin',
      username: 'workflowadmin',
      email: 'workflowadmin@test.com',
      role: 'admin',
      status: 'active',
    });

    // Create test media
    const media = await this.createTestMedia({
      tmdbId: 999999,
      mediaType: 'movie',
      title: 'Workflow Test Movie',
    });

    // Create test request
    const request = await this.createTestMediaRequest({
      userId: user.id,
      mediaId: media.id,
      status: 'pending',
      quality: 'HD',
      notes: 'Test workflow request',
    });

    return { user, admin, media, request };
  }

  /**
   * Clear all test data from database
   */
  async clearTestData(): Promise<void> {
    if (this.isConnectionBroken) {
      return; // Can't clear if connection is broken
    }

    try {
      // Delete in correct order to respect foreign key constraints
      await this.prisma.mediaRequest.deleteMany();
      await this.prisma.media.deleteMany();
      await this.prisma.user.deleteMany();

      console.log('🧹 Test data cleared');
    } catch (error) {
      console.error('❌ Failed to clear test data:', error);
      throw error;
    }
  }

  /**
   * Execute a function within a transaction
   */
  async withTransaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    if (this.isConnectionBroken) {
      throw new Error('Database connection is broken');
    }

    return await this.prisma.$transaction(async (tx) => {
      return await fn(tx as PrismaClient);
    });
  }

  /**
   * Test concurrent database operations
   */
  async testConcurrentOperations(operationCount: number = 10): Promise<{
    successCount: number;
    failureCount: number;
    avgDuration: number;
  }> {
    if (this.isConnectionBroken) {
      throw new Error('Database connection is broken');
    }

    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;

    const operations = Array.from({ length: operationCount }, (_, i) =>
      this.createTestUser({
        plexId: `concurrent-user-${i}-${Date.now()}`,
        username: `concurrent${i}`,
        email: `concurrent${i}@test.com`,
        role: 'user',
        status: 'active',
      })
        .then(() => {
          successCount++;
        })
        .catch(() => {
          failureCount++;
        }),
    );

    await Promise.all(operations);

    const totalDuration = Date.now() - startTime;
    const avgDuration = totalDuration / operationCount;

    return {
      successCount,
      failureCount,
      avgDuration,
    };
  }

  /**
   * Test database performance with large datasets
   */
  async testLargeDatasetPerformance(): Promise<{
    insertTime: number;
    queryTime: number;
    updateTime: number;
    deleteTime: number;
  }> {
    if (this.isConnectionBroken) {
      throw new Error('Database connection is broken');
    }

    const recordCount = 1000;
    let insertTime: number;
    let queryTime: number;
    let updateTime: number;
    let deleteTime: number;

    // Test bulk insert
    console.log(`🚀 Testing bulk insert of ${recordCount} records...`);
    const insertStart = Date.now();

    const users = Array.from({ length: recordCount }, (_, i) => ({
      plexId: `perf-user-${i}`,
      plexUsername: `perfuser${i}`,
      email: `perf${i}@test.com`,
      role: 'user' as const,
      status: 'active' as const,
      plexToken: 'test-token',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await this.prisma.user.createMany({
      data: users,
      skipDuplicates: true,
    });

    insertTime = Date.now() - insertStart;
    console.log(`✅ Bulk insert completed in ${insertTime}ms`);

    // Test query performance
    console.log('🔍 Testing query performance...');
    const queryStart = Date.now();

    const queriedUsers = await this.prisma.user.findMany({
      where: {
        plexUsername: {
          startsWith: 'perfuser',
        },
      },
      take: 100,
    });

    queryTime = Date.now() - queryStart;
    console.log(`✅ Query completed in ${queryTime}ms (found ${queriedUsers.length} records)`);

    // Test bulk update
    console.log('📝 Testing bulk update...');
    const updateStart = Date.now();

    await this.prisma.user.updateMany({
      where: {
        plexUsername: {
          startsWith: 'perfuser',
        },
      },
      data: {
        status: 'inactive',
        updatedAt: new Date(),
      },
    });

    updateTime = Date.now() - updateStart;
    console.log(`✅ Bulk update completed in ${updateTime}ms`);

    // Test bulk delete
    console.log('🗑️  Testing bulk delete...');
    const deleteStart = Date.now();

    await this.prisma.user.deleteMany({
      where: {
        plexUsername: {
          startsWith: 'perfuser',
        },
      },
    });

    deleteTime = Date.now() - deleteStart;
    console.log(`✅ Bulk delete completed in ${deleteTime}ms`);

    return {
      insertTime,
      queryTime,
      updateTime,
      deleteTime,
    };
  }

  /**
   * Simulate database connection error
   */
  async simulateConnectionError(): Promise<void> {
    console.log('💥 Simulating database connection error...');
    this.isConnectionBroken = true;

    // Disconnect Prisma client
    await this.prisma.$disconnect();
  }

  /**
   * Restore database connection
   */
  async restoreConnection(): Promise<void> {
    console.log('🔄 Restoring database connection...');
    this.isConnectionBroken = false;

    // Reconnect Prisma client
    await this.prisma.$connect();
    console.log('✅ Database connection restored');
  }

  /**
   * Get database connection status
   */
  async getConnectionStatus(): Promise<{
    connected: boolean;
    responseTime: number;
  }> {
    if (this.isConnectionBroken) {
      return { connected: false, responseTime: -1 };
    }

    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - start;

      return { connected: true, responseTime };
    } catch (error) {
      return { connected: false, responseTime: -1 };
    }
  }

  /**
   * Check referential integrity
   */
  async checkReferentialIntegrity(): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    if (this.isConnectionBroken) {
      return { valid: false, issues: ['Database connection is broken'] };
    }

    const issues: string[] = [];

    try {
      // Check for orphaned media requests (requests without valid user)
      const orphanedRequests = await this.prisma.mediaRequest.count({
        where: {
          user: null,
        },
      });

      if (orphanedRequests > 0) {
        issues.push(`Found ${orphanedRequests} media requests without valid user`);
      }

      // Check for orphaned media requests (requests without valid media)
      const orphanedMediaRequests = await this.prisma.mediaRequest.count({
        where: {
          media: null,
        },
      });

      if (orphanedMediaRequests > 0) {
        issues.push(`Found ${orphanedMediaRequests} media requests without valid media`);
      }

      // Add more integrity checks as needed...

      return {
        valid: issues.length === 0,
        issues,
      };
    } catch (error) {
      issues.push(`Error checking integrity: ${error}`);
      return { valid: false, issues };
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<{
    users: number;
    mediaRequests: number;
    media: number;
    totalRecords: number;
  }> {
    if (this.isConnectionBroken) {
      throw new Error('Database connection is broken');
    }

    const [users, mediaRequests, media] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.mediaRequest.count(),
      this.prisma.media.count(),
    ]);

    return {
      users,
      mediaRequests,
      media,
      totalRecords: users + mediaRequests + media,
    };
  }

  /**
   * Cleanup and disconnect
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up database test helper...');

    try {
      if (!this.isConnectionBroken) {
        await this.clearTestData();
      }
      await this.prisma.$disconnect();
    } catch (error) {
      console.error('❌ Error during database cleanup:', error);
    }

    console.log('✅ Database test helper cleanup complete');
  }
}
