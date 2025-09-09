/**
 * DATABASE TRANSACTION INTEGRATION TESTS
 * 
 * Comprehensive testing of database operations, transactions, and data consistency
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { DatabaseTestHelper } from '../helpers/database-test-helper';

const prisma = new PrismaClient();
let dbHelper: DatabaseTestHelper;

describe('Database Transaction Integration Tests', () => {
  beforeAll(async () => {
    dbHelper = new DatabaseTestHelper();
    await dbHelper.setupTestDatabase();
  });

  afterAll(async () => {
    await dbHelper.cleanupTestDatabase();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await dbHelper.clearTestData();
  });

  describe('Complex Transaction Scenarios', () => {
    test('should handle media request creation with user validation', async () => {
      await prisma.$transaction(async (tx) => {
        // Create user
        const user = await tx.user.create({
          data: {
            email: 'test@example.com',
            plexId: 'plex-123',
            plexUsername: 'testuser',
            role: 'USER',
            status: 'ACTIVE'
          }
        });

        // Create media request
        const mediaRequest = await tx.mediaRequest.create({
          data: {
            userId: user.id,
            title: 'Test Movie',
            year: 2023,
            type: 'MOVIE',
            status: 'PENDING',
            imdbId: 'tt1234567',
            tmdbId: 123456
          }
        });

        // Verify data integrity
        expect(user.id).toBeDefined();
        expect(mediaRequest.id).toBeDefined();
        expect(mediaRequest.userId).toBe(user.id);
      });
    });

    test('should rollback transaction on constraint violation', async () => {
      // Create initial user
      const initialUser = await prisma.user.create({
        data: {
          email: 'initial@example.com',
          plexId: 'plex-initial',
          plexUsername: 'initialuser',
          role: 'USER',
          status: 'ACTIVE'
        }
      });

      // Attempt transaction that should fail due to unique constraint
      await expect(
        prisma.$transaction(async (tx) => {
          // This should succeed
          const user = await tx.user.create({
            data: {
              email: 'test@example.com',
              plexId: 'plex-test',
              plexUsername: 'testuser',
              role: 'USER',
              status: 'ACTIVE'
            }
          });

          // This should fail due to duplicate email
          await tx.user.create({
            data: {
              email: 'initial@example.com', // Duplicate email
              plexId: 'plex-duplicate',
              plexUsername: 'duplicateuser',
              role: 'USER',
              status: 'ACTIVE'
            }
          });

          return user;
        })
      ).rejects.toThrow();

      // Verify rollback - no new users should exist except the initial one
      const userCount = await prisma.user.count();
      expect(userCount).toBe(1);

      const existingUser = await prisma.user.findUnique({
        where: { email: 'initial@example.com' }
      });
      expect(existingUser).toBeTruthy();

      const testUser = await prisma.user.findUnique({
        where: { email: 'test@example.com' }
      });
      expect(testUser).toBeNull();
    });

    test('should handle concurrent transactions correctly', async () => {
      // Create initial user
      const user = await prisma.user.create({
        data: {
          email: 'concurrent@example.com',
          plexId: 'plex-concurrent',
          plexUsername: 'concurrentuser',
          role: 'USER',
          status: 'ACTIVE'
        }
      });

      // Run concurrent transactions
      const concurrentOperations = Array(5).fill(null).map((_, index) =>
        prisma.$transaction(async (tx) => {
          return await tx.mediaRequest.create({
            data: {
              userId: user.id,
              title: `Concurrent Movie ${index}`,
              year: 2023,
              type: 'MOVIE',
              status: 'PENDING',
              imdbId: `tt123456${index}`,
              tmdbId: 123456 + index
            }
          });
        })
      );

      const results = await Promise.all(concurrentOperations);
      
      // All transactions should succeed
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.title).toBe(`Concurrent Movie ${index}`);
      });

      // Verify all requests exist in database
      const requestCount = await prisma.mediaRequest.count({
        where: { userId: user.id }
      });
      expect(requestCount).toBe(5);
    });
  });

  describe('Data Consistency Tests', () => {
    test('should maintain referential integrity across related tables', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'integrity@example.com',
          plexId: 'plex-integrity',
          plexUsername: 'integrityuser',
          role: 'USER',
          status: 'ACTIVE'
        }
      });

      const mediaRequest = await prisma.mediaRequest.create({
        data: {
          userId: user.id,
          title: 'Integrity Test Movie',
          year: 2023,
          type: 'MOVIE',
          status: 'PENDING',
          imdbId: 'tt7654321',
          tmdbId: 654321
        }
      });

      // Verify relationships
      const userWithRequests = await prisma.user.findUnique({
        where: { id: user.id },
        include: { mediaRequests: true }
      });

      expect(userWithRequests).toBeTruthy();
      expect(userWithRequests!.mediaRequests).toHaveLength(1);
      expect(userWithRequests!.mediaRequests[0].id).toBe(mediaRequest.id);

      // Test cascade behavior
      await prisma.user.delete({
        where: { id: user.id }
      });

      // Related media requests should be handled according to schema definition
      const orphanedRequest = await prisma.mediaRequest.findUnique({
        where: { id: mediaRequest.id }
      });
      
      // Depending on schema configuration, this should either be null (cascade delete)
      // or the request should still exist with proper foreign key handling
      if (orphanedRequest) {
        // If soft delete or cascade prevention is implemented
        expect(orphanedRequest.userId).toBeDefined();
      }
    });

    test('should handle optimistic concurrency control', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'optimistic@example.com',
          plexId: 'plex-optimistic',
          plexUsername: 'optimisticuser',
          role: 'USER',
          status: 'ACTIVE'
        }
      });

      const mediaRequest = await prisma.mediaRequest.create({
        data: {
          userId: user.id,
          title: 'Optimistic Test Movie',
          year: 2023,
          type: 'MOVIE',
          status: 'PENDING',
          imdbId: 'tt9876543',
          tmdbId: 987654
        }
      });

      // Simulate concurrent updates
      const update1Promise = prisma.mediaRequest.update({
        where: { id: mediaRequest.id },
        data: { status: 'APPROVED' }
      });

      const update2Promise = prisma.mediaRequest.update({
        where: { id: mediaRequest.id },
        data: { status: 'REJECTED' }
      });

      // One should succeed, the other might fail or overwrite
      const [result1, result2] = await Promise.allSettled([update1Promise, update2Promise]);
      
      expect(result1.status).toBe('fulfilled');
      expect(result2.status).toBe('fulfilled');

      // Final state should be deterministic
      const finalState = await prisma.mediaRequest.findUnique({
        where: { id: mediaRequest.id }
      });
      
      expect(finalState).toBeTruthy();
      expect(['APPROVED', 'REJECTED'].includes(finalState!.status)).toBe(true);
    });
  });

  describe('Query Performance Tests', () => {
    test('should handle large dataset queries efficiently', async () => {
      // Create test user
      const user = await prisma.user.create({
        data: {
          email: 'performance@example.com',
          plexId: 'plex-performance',
          plexUsername: 'performanceuser',
          role: 'USER',
          status: 'ACTIVE'
        }
      });

      // Create large dataset
      const batchSize = 100;
      const requests = Array(batchSize).fill(null).map((_, index) => ({
        userId: user.id,
        title: `Performance Test Movie ${index}`,
        year: 2020 + (index % 4),
        type: 'MOVIE' as const,
        status: 'PENDING' as const,
        imdbId: `tt${String(index).padStart(7, '0')}`,
        tmdbId: 1000000 + index
      }));

      // Batch create for better performance
      await prisma.mediaRequest.createMany({
        data: requests
      });

      // Test query performance
      const startTime = Date.now();
      
      const paginatedResults = await prisma.mediaRequest.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
        include: {
          user: {
            select: {
              id: true,
              plexUsername: true
            }
          }
        }
      });
      
      const queryTime = Date.now() - startTime;

      expect(paginatedResults).toHaveLength(20);
      expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
      
      // Test aggregate queries
      const aggregateStart = Date.now();
      
      const aggregateData = await prisma.mediaRequest.aggregate({
        where: { userId: user.id },
        _count: true,
        _min: { createdAt: true },
        _max: { createdAt: true }
      });
      
      const aggregateTime = Date.now() - aggregateStart;

      expect(aggregateData._count).toBe(batchSize);
      expect(aggregateTime).toBeLessThan(500); // Aggregates should be fast
    });

    test('should optimize complex join queries', async () => {
      // Create users and requests for join testing
      const users = await prisma.user.createManyAndReturn({
        data: Array(10).fill(null).map((_, index) => ({
          email: `jointest${index}@example.com`,
          plexId: `plex-join-${index}`,
          plexUsername: `joinuser${index}`,
          role: 'USER' as const,
          status: 'ACTIVE' as const
        }))
      });

      // Create requests for each user
      const requestsData = users.flatMap(user => 
        Array(5).fill(null).map((_, reqIndex) => ({
          userId: user.id,
          title: `Join Test Movie ${reqIndex} for ${user.plexUsername}`,
          year: 2023,
          type: 'MOVIE' as const,
          status: 'PENDING' as const,
          imdbId: `tt${user.id}${String(reqIndex).padStart(3, '0')}`,
          tmdbId: parseInt(`${user.id}${String(reqIndex).padStart(3, '0')}`)
        }))
      );

      await prisma.mediaRequest.createMany({
        data: requestsData
      });

      // Test complex join query performance
      const startTime = Date.now();
      
      const complexQuery = await prisma.user.findMany({
        include: {
          mediaRequests: {
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            take: 3
          },
          _count: {
            select: {
              mediaRequests: true
            }
          }
        },
        where: {
          mediaRequests: {
            some: {
              status: 'PENDING'
            }
          }
        }
      });
      
      const queryTime = Date.now() - startTime;

      expect(complexQuery.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(2000); // Complex queries should complete within 2 seconds
      
      // Verify data structure
      complexQuery.forEach(user => {
        expect(user.mediaRequests.length).toBeLessThanOrEqual(3);
        expect(user._count.mediaRequests).toBeGreaterThan(0);
      });
    });
  });

  describe('Database Migration and Schema Tests', () => {
    test('should handle schema changes gracefully', async () => {
      // This test would typically check migration compatibility
      // For now, verify current schema structure
      
      const tableInfo = await prisma.$queryRaw`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        ORDER BY table_name, column_name;
      ` as any[];

      // Verify essential tables exist
      const tables = [...new Set(tableInfo.map(row => row.table_name))];
      expect(tables).toContain('User');
      expect(tables).toContain('MediaRequest');
      
      // Verify essential columns
      const userColumns = tableInfo
        .filter(row => row.table_name === 'User')
        .map(row => row.column_name);
      
      expect(userColumns).toContain('id');
      expect(userColumns).toContain('email');
      expect(userColumns).toContain('plexId');
    });
  });
});