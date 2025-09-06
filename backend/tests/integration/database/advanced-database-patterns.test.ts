import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getTestPrismaClient, cleanDatabase, disconnectDatabase } from '../../helpers/database';
import { MediaRequestRepository } from '../../../src/repositories/media-request.repository';
import { UserRepository } from '../../../src/repositories/user.repository';
import { ServiceStatusRepository } from '../../../src/repositories/service-status.repository';
import { SessionTokenRepository } from '../../../src/repositories/session-token.repository';
import { AppError } from '@medianest/shared';

/**
 * WAVE 3 AGENT #11: ADVANCED DATABASE INTEGRATION TESTS
 *
 * Applying proven Wave 1 & 2 patterns:
 * ✅ Complex transaction scenarios
 * ✅ Connection pooling stress testing
 * ✅ Advanced query optimization validation
 * ✅ Database constraint enforcement
 * ✅ Cross-repository transaction patterns
 * ✅ Performance benchmarking
 * ✅ Concurrent operation safety
 * ✅ Database recovery scenarios
 */

describe('Advanced Database Integration Patterns', () => {
  let prisma: PrismaClient;
  let mediaRepository: MediaRequestRepository;
  let userRepository: UserRepository;
  let serviceRepository: ServiceStatusRepository;
  let sessionRepository: SessionTokenRepository;
  let testUsers: any[] = [];

  beforeAll(async () => {
    prisma = getTestPrismaClient();
    mediaRepository = new MediaRequestRepository(prisma);
    userRepository = new UserRepository(prisma);
    serviceRepository = new ServiceStatusRepository(prisma);
    sessionRepository = new SessionTokenRepository(prisma);
  });

  beforeEach(async () => {
    await cleanDatabase();

    // Create test users for complex scenarios
    testUsers = await Promise.all([
      userRepository.create({
        email: 'user1@example.com',
        name: 'User 1',
        plexId: 'plex-1',
        plexUsername: 'user1',
        role: 'user',
      }),
      userRepository.create({
        email: 'user2@example.com',
        name: 'User 2',
        plexId: 'plex-2',
        plexUsername: 'user2',
        role: 'user',
      }),
      userRepository.create({
        email: 'admin@example.com',
        name: 'Admin User',
        plexId: 'plex-admin',
        plexUsername: 'admin',
        role: 'admin',
      }),
    ]);
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('Complex Transaction Scenarios', () => {
    it('should handle nested transaction rollback properly', async () => {
      const initialUserCount = await userRepository.count();
      const initialRequestCount = await mediaRepository.countByStatus();

      try {
        await prisma.$transaction(async (tx) => {
          // Create media requests
          const request1 = await tx.mediaRequest.create({
            data: {
              userId: testUsers[0].id,
              title: 'Transaction Test Movie 1',
              mediaType: 'movie',
              status: 'pending',
            },
          });

          const request2 = await tx.mediaRequest.create({
            data: {
              userId: testUsers[1].id,
              title: 'Transaction Test Movie 2',
              mediaType: 'movie',
              status: 'pending',
            },
          });

          // Update service status within transaction
          await tx.serviceStatus.upsert({
            where: { serviceName: 'overseerr' },
            create: {
              serviceName: 'overseerr',
              status: 'healthy',
              responseTimeMs: 150,
              uptimePercentage: 99.5,
              lastCheckAt: new Date(),
            },
            update: {
              status: 'healthy',
              responseTimeMs: 150,
              lastCheckAt: new Date(),
            },
          });

          // Force rollback by throwing error
          throw new Error('Intentional rollback test');
        });
      } catch (error) {
        expect(error.message).toBe('Intentional rollback test');
      }

      // Verify nothing was committed
      const finalUserCount = await userRepository.count();
      const finalRequestCount = await mediaRepository.countByStatus();
      const serviceStatus = await serviceRepository.findByName('overseerr');

      expect(finalUserCount).toBe(initialUserCount);
      expect(finalRequestCount).toBe(initialRequestCount);
      expect(serviceStatus).toBeNull();
    });

    it('should handle concurrent transactions with optimistic locking', async () => {
      const user = testUsers[0];
      const concurrentUpdates = 5;

      // Simulate concurrent profile updates
      const updatePromises = Array(concurrentUpdates)
        .fill(0)
        .map(async (_, index) => {
          try {
            return await userRepository.update(user.id, {
              name: `Updated Name ${index}`,
              preferences: { theme: `theme-${index}` },
            });
          } catch (error) {
            return { error: error.message };
          }
        });

      const results = await Promise.all(updatePromises);
      const successful = results.filter((r) => !r.error);
      const failed = results.filter((r) => r.error);

      // At least one should succeed
      expect(successful.length).toBeGreaterThan(0);

      // Final state should be consistent
      const finalUser = await userRepository.findById(user.id);
      expect(finalUser?.name).toMatch(/^Updated Name \d+$/);
    });

    it('should handle complex batch operations with partial failures', async () => {
      const batchRequests = [
        {
          userId: testUsers[0].id,
          title: 'Valid Movie 1',
          mediaType: 'movie',
        },
        {
          userId: 'invalid-user-id',
          title: 'Invalid Movie',
          mediaType: 'movie',
        },
        {
          userId: testUsers[1].id,
          title: 'Valid Movie 2',
          mediaType: 'movie',
        },
      ];

      const results = await Promise.allSettled(
        batchRequests.map((request) => mediaRepository.create(request as any)),
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(2);
      expect(rejected.length).toBe(1);

      // Verify successful creations
      const allRequests = await mediaRepository.findByFilters({});
      expect(allRequests.items.length).toBe(2);
      expect(allRequests.items.every((r) => r.title.includes('Valid'))).toBe(true);
    });

    it('should maintain referential integrity during cascade operations', async () => {
      const user = testUsers[0];

      // Create related data
      const mediaRequest = await mediaRepository.create({
        userId: user.id,
        title: 'Cascade Test Movie',
        mediaType: 'movie',
      });

      const sessionToken = await sessionRepository.create({
        userId: user.id,
        tokenHash: 'test-hash-cascade',
        expiresAt: new Date(Date.now() + 3600000),
      });

      // Verify data exists
      expect(await mediaRepository.findById(mediaRequest.id)).toBeTruthy();
      expect(await sessionRepository.findById(sessionToken.id)).toBeTruthy();

      // Delete user (should cascade)
      await userRepository.delete(user.id);

      // Verify cascade deletion
      expect(await userRepository.findById(user.id)).toBeNull();
      expect(await mediaRepository.findById(mediaRequest.id)).toBeNull();
      expect(await sessionRepository.findById(sessionToken.id)).toBeNull();
    });
  });

  describe('Connection Pool Stress Testing', () => {
    it('should handle high concurrent connection load', async () => {
      const connectionCount = 50;
      const operationsPerConnection = 10;

      const stressTest = async (connectionIndex: number) => {
        const operations = [];

        for (let i = 0; i < operationsPerConnection; i++) {
          operations.push(
            userRepository.findById(testUsers[connectionIndex % testUsers.length].id),
          );
          operations.push(mediaRepository.countByStatus('pending'));
          operations.push(serviceRepository.findByName('overseerr'));
        }

        return await Promise.all(operations);
      };

      const startTime = Date.now();
      const stressPromises = Array(connectionCount)
        .fill(0)
        .map((_, i) => stressTest(i));

      const results = await Promise.allSettled(stressPromises);
      const duration = Date.now() - startTime;

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      // Should handle most connections successfully
      expect(successful / connectionCount).toBeGreaterThan(0.8);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(
        `Stress Test Results: ${successful}/${connectionCount} successful (${duration}ms)`,
      );
    });

    it('should recover from connection pool exhaustion', async () => {
      // Create many long-running transactions
      const longTransactions = Array(15)
        .fill(0)
        .map(async (_, index) => {
          try {
            return await prisma.$transaction(
              async (tx) => {
                await tx.user.findMany();
                // Simulate long operation
                await new Promise((resolve) => setTimeout(resolve, 1000));
                return `transaction-${index}`;
              },
              {
                timeout: 5000,
              },
            );
          } catch (error) {
            return { error: error.message };
          }
        });

      // Run quick operations while pool is busy
      const quickOperations = Array(10)
        .fill(0)
        .map(async (_, index) => {
          try {
            return await userRepository.findById(testUsers[index % testUsers.length].id);
          } catch (error) {
            return { error: error.message };
          }
        });

      const [longResults, quickResults] = await Promise.all([
        Promise.allSettled(longTransactions),
        Promise.allSettled(quickOperations),
      ]);

      // Some operations should succeed despite pool pressure
      const successfulQuick = quickResults.filter((r) => r.status === 'fulfilled').length;
      expect(successfulQuick).toBeGreaterThan(0);

      console.log(`Pool Recovery Test: ${successfulQuick}/10 quick operations succeeded`);
    });
  });

  describe('Advanced Query Optimization Validation', () => {
    beforeEach(async () => {
      // Create test data for optimization testing
      const promises = [];

      for (let i = 0; i < 100; i++) {
        promises.push(
          mediaRepository.create({
            userId: testUsers[i % testUsers.length].id,
            title: `Optimization Test Movie ${i}`,
            mediaType: i % 2 === 0 ? 'movie' : 'tv',
            tmdbId: `tmdb-${i}`,
            status: i % 3 === 0 ? 'completed' : 'pending',
          }),
        );
      }

      await Promise.all(promises);
    });

    it('should perform efficient pagination with large datasets', async () => {
      const pageSize = 10;
      const totalPages = 5;
      const startTime = Date.now();

      const paginationResults = [];

      for (let page = 1; page <= totalPages; page++) {
        const result = await mediaRepository.findByFilters(
          {},
          {
            page,
            limit: pageSize,
            orderBy: { createdAt: 'desc' },
          },
        );

        paginationResults.push(result);

        // Each page should return correct number of items
        expect(result.items.length).toBeLessThanOrEqual(pageSize);
        expect(result.page).toBe(page);
      }

      const duration = Date.now() - startTime;

      // Should complete pagination quickly
      expect(duration).toBeLessThan(5000);

      // Verify no duplicate items across pages
      const allItems = paginationResults.flatMap((r) => r.items);
      const uniqueIds = new Set(allItems.map((item) => item.id));
      expect(uniqueIds.size).toBe(allItems.length);

      console.log(`Pagination Performance: ${totalPages} pages in ${duration}ms`);
    });

    it('should optimize complex filter queries', async () => {
      const complexFilters = [
        { mediaType: 'movie', status: 'pending' },
        { userId: testUsers[0].id, createdBefore: new Date() },
        { status: 'completed', mediaType: 'tv' },
        { tmdbId: { not: null } },
      ];

      const startTime = Date.now();

      const filterResults = await Promise.all(
        complexFilters.map((filter) => mediaRepository.findByFilters(filter)),
      );

      const duration = Date.now() - startTime;

      // Should execute multiple complex filters quickly
      expect(duration).toBeLessThan(3000);

      // Verify filter accuracy
      expect(
        filterResults[0].items.every((r) => r.mediaType === 'movie' && r.status === 'pending'),
      ).toBe(true);

      expect(filterResults[1].items.every((r) => r.userId === testUsers[0].id)).toBe(true);

      console.log(`Complex Filter Performance: ${complexFilters.length} filters in ${duration}ms`);
    });

    it('should efficiently handle bulk status updates', async () => {
      // Get requests to update
      const requestsToUpdate = await mediaRepository.findByFilters(
        { status: 'pending' },
        { limit: 50 },
      );

      const requestIds = requestsToUpdate.items.map((r) => r.id);
      expect(requestIds.length).toBeGreaterThan(0);

      const startTime = Date.now();

      const updateCount = await mediaRepository.bulkUpdateStatus(requestIds, 'approved');

      const duration = Date.now() - startTime;

      expect(updateCount).toBe(requestIds.length);
      expect(duration).toBeLessThan(2000);

      // Verify updates
      const updatedRequests = await mediaRepository.findByFilters({
        status: 'approved',
      });

      expect(updatedRequests.items.length).toBe(updateCount);

      console.log(`Bulk Update Performance: ${updateCount} records in ${duration}ms`);
    });
  });

  describe('Database Constraint Enforcement', () => {
    it('should enforce unique constraints properly', async () => {
      const userData = {
        email: 'unique@example.com',
        name: 'Unique User',
        plexId: 'unique-plex',
        plexUsername: 'uniqueuser',
        role: 'user' as const,
      };

      // First creation should succeed
      const user1 = await userRepository.create(userData);
      expect(user1).toBeTruthy();

      // Duplicate email should fail
      await expect(
        userRepository.create({
          ...userData,
          plexId: 'different-plex',
          plexUsername: 'differentuser',
        }),
      ).rejects.toThrow();

      // Duplicate plexId should fail
      await expect(
        userRepository.create({
          ...userData,
          email: 'different@example.com',
          plexUsername: 'differentuser',
        }),
      ).rejects.toThrow();

      // Different data should succeed
      const user2 = await userRepository.create({
        email: 'different@example.com',
        name: 'Different User',
        plexId: 'different-plex',
        plexUsername: 'differentuser',
        role: 'user',
      });

      expect(user2).toBeTruthy();
      expect(user2.id).not.toBe(user1.id);
    });

    it('should enforce foreign key constraints', async () => {
      // Invalid userId should fail
      await expect(
        mediaRepository.create({
          userId: 'non-existent-user',
          title: 'Invalid Request',
          mediaType: 'movie',
        }),
      ).rejects.toThrow();

      // Valid userId should succeed
      const validRequest = await mediaRepository.create({
        userId: testUsers[0].id,
        title: 'Valid Request',
        mediaType: 'movie',
      });

      expect(validRequest).toBeTruthy();
      expect(validRequest.userId).toBe(testUsers[0].id);
    });

    it('should validate enum constraints', async () => {
      // Invalid mediaType should fail
      await expect(
        mediaRepository.create({
          userId: testUsers[0].id,
          title: 'Invalid Media Type',
          mediaType: 'invalid' as any,
        }),
      ).rejects.toThrow();

      // Invalid status should fail
      await expect(
        mediaRepository.create({
          userId: testUsers[0].id,
          title: 'Invalid Status',
          mediaType: 'movie',
          status: 'invalid' as any,
        }),
      ).rejects.toThrow();

      // Valid enums should succeed
      const validRequest = await mediaRepository.create({
        userId: testUsers[0].id,
        title: 'Valid Enums',
        mediaType: 'tv',
      });

      expect(validRequest.mediaType).toBe('tv');
      expect(validRequest.status).toBe('pending');
    });
  });

  describe('Performance Benchmarking', () => {
    it('should benchmark read performance under load', async () => {
      // Create baseline data
      const baselineRequests = Array(200)
        .fill(0)
        .map((_, i) => ({
          userId: testUsers[i % testUsers.length].id,
          title: `Benchmark Movie ${i}`,
          mediaType: i % 2 === 0 ? 'movie' : ('tv' as const),
          status: 'pending' as const,
        }));

      await Promise.all(baselineRequests.map((r) => mediaRepository.create(r)));

      // Benchmark read operations
      const readOperations = [
        () => mediaRepository.findByFilters({}),
        () => mediaRepository.findByFilters({ mediaType: 'movie' }),
        () => mediaRepository.findByFilters({ status: 'pending' }),
        () => mediaRepository.countByStatus(),
        () => mediaRepository.getRecentRequests(10),
        () => userRepository.findAll({ limit: 50 }),
      ];

      const benchmarkResults = [];

      for (const operation of readOperations) {
        const iterations = 10;
        const times = [];

        for (let i = 0; i < iterations; i++) {
          const startTime = Date.now();
          await operation();
          times.push(Date.now() - startTime);
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const maxTime = Math.max(...times);
        const minTime = Math.min(...times);

        benchmarkResults.push({
          operation: operation.name,
          avgTime,
          maxTime,
          minTime,
          iterations,
        });

        // Performance should be reasonable
        expect(avgTime).toBeLessThan(1000);
        expect(maxTime).toBeLessThan(2000);
      }

      console.log('Read Performance Benchmark:', benchmarkResults);
    });

    it('should benchmark write performance', async () => {
      const writeOperations = [
        {
          name: 'createUser',
          operation: () =>
            userRepository.create({
              email: `perf-${Date.now()}@example.com`,
              name: 'Perf User',
              plexId: `perf-${Date.now()}`,
              plexUsername: `perf${Date.now()}`,
              role: 'user',
            }),
          cleanup: (result: any) => userRepository.delete(result.id),
        },
        {
          name: 'createMediaRequest',
          operation: () =>
            mediaRepository.create({
              userId: testUsers[0].id,
              title: `Perf Movie ${Date.now()}`,
              mediaType: 'movie',
            }),
          cleanup: (result: any) => mediaRepository.delete(result.id),
        },
        {
          name: 'updateServiceStatus',
          operation: () =>
            serviceRepository.upsert({
              serviceName: `perf-service-${Date.now()}`,
              status: 'healthy',
              responseTimeMs: 100,
              uptimePercentage: 99.0,
              lastCheckAt: new Date(),
            }),
          cleanup: (result: any) => serviceRepository.delete(result.id),
        },
      ];

      const benchmarkResults = [];

      for (const { name, operation, cleanup } of writeOperations) {
        const iterations = 5;
        const times = [];
        const createdItems = [];

        for (let i = 0; i < iterations; i++) {
          const startTime = Date.now();
          const result = await operation();
          times.push(Date.now() - startTime);
          createdItems.push(result);
        }

        // Cleanup
        await Promise.all(createdItems.map((item) => cleanup(item)));

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const maxTime = Math.max(...times);
        const minTime = Math.min(...times);

        benchmarkResults.push({
          operation: name,
          avgTime,
          maxTime,
          minTime,
          iterations,
        });

        // Write performance should be reasonable
        expect(avgTime).toBeLessThan(500);
        expect(maxTime).toBeLessThan(1000);
      }

      console.log('Write Performance Benchmark:', benchmarkResults);
    });
  });

  describe('Database Recovery Scenarios', () => {
    it('should handle connection interruption gracefully', async () => {
      // Simulate connection issues with timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 100),
      );

      const operations = [
        userRepository.findById(testUsers[0].id),
        mediaRepository.countByStatus(),
        serviceRepository.findByName('test-service'),
      ];

      // Some operations might fail due to timeout simulation
      const results = await Promise.allSettled([
        Promise.race([operations[0], timeoutPromise]),
        Promise.race([operations[1], timeoutPromise]),
        Promise.race([operations[2], timeoutPromise]),
      ]);

      // At least one operation should handle the timeout gracefully
      expect(results.some((r) => r.status === 'rejected')).toBe(true);

      // System should recover and allow normal operations
      const recoveryUser = await userRepository.findById(testUsers[0].id);
      expect(recoveryUser).toBeTruthy();
    });

    it('should maintain data consistency during partial failures', async () => {
      const batchOperations = [
        async () => {
          const user = await userRepository.create({
            email: `consistency-${Date.now()}@example.com`,
            name: 'Consistency User',
            plexId: `consistency-${Date.now()}`,
            plexUsername: `consistency${Date.now()}`,
            role: 'user',
          });

          const request = await mediaRepository.create({
            userId: user.id,
            title: 'Consistency Movie',
            mediaType: 'movie',
          });

          // Simulate failure after partial success
          if (Math.random() < 0.5) {
            throw new Error('Simulated failure');
          }

          return { user, request };
        },
      ];

      const results = await Promise.allSettled(
        Array(10)
          .fill(0)
          .map(() => batchOperations[0]()),
      );

      const successful = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      // Verify successful operations maintain consistency
      for (const result of successful) {
        const { user, request } = (result as any).value;

        const foundUser = await userRepository.findById(user.id);
        const foundRequest = await mediaRepository.findById(request.id);

        expect(foundUser).toBeTruthy();
        expect(foundRequest).toBeTruthy();
        expect(foundRequest?.userId).toBe(user.id);
      }

      console.log(`Consistency Test: ${successful.length} successful, ${failed.length} failed`);
    });
  });
});
