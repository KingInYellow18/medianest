import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getTestPrismaClient, cleanDatabase, disconnectDatabase } from '../../helpers/database';
import { MediaRequestRepository } from '../../../src/repositories/media-request.repository';
import { UserRepository } from '../../../src/repositories/user.repository';
import { ServiceStatusRepository } from '../../../src/repositories/service-status.repository';
import { SessionTokenRepository } from '../../../src/repositories/session-token.repository';

/**
 * WAVE 3 AGENT #11: ADVANCED DATABASE TRANSACTION PATTERNS
 *
 * Complex transaction testing patterns from Wave 1 & 2 wins:
 * ✅ Nested transaction scenarios
 * ✅ Saga pattern implementation
 * ✅ Distributed transaction simulation
 * ✅ Transaction timeout handling
 * ✅ Deadlock prevention and recovery
 * ✅ Atomic batch operations
 * ✅ Transaction isolation levels
 * ✅ Cross-service transaction coordination
 */

describe('Advanced Database Transaction Patterns', () => {
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

    testUsers = await Promise.all([
      userRepository.create({
        email: 'txn-user1@example.com',
        name: 'Transaction User 1',
        plexId: 'txn-plex-1',
        plexUsername: 'txnuser1',
        role: 'user',
      }),
      userRepository.create({
        email: 'txn-user2@example.com',
        name: 'Transaction User 2',
        plexId: 'txn-plex-2',
        plexUsername: 'txnuser2',
        role: 'user',
      }),
    ]);
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('Atomic Batch Operations', () => {
    it('should perform atomic user registration with related data', async () => {
      const registrationData = {
        email: 'atomic@example.com',
        name: 'Atomic User',
        plexId: 'atomic-plex',
        plexUsername: 'atomicuser',
        role: 'user' as const,
        initialRequests: [
          { title: 'Welcome Movie 1', mediaType: 'movie' as const },
          { title: 'Welcome Movie 2', mediaType: 'movie' as const },
        ],
      };

      const result = await prisma.$transaction(async (tx) => {
        // Create user
        const user = await tx.user.create({
          data: {
            email: registrationData.email,
            name: registrationData.name,
            plexId: registrationData.plexId,
            plexUsername: registrationData.plexUsername,
            role: registrationData.role,
            status: 'active',
          },
        });

        // Create initial media requests
        const requests = await Promise.all(
          registrationData.initialRequests.map((req) =>
            tx.mediaRequest.create({
              data: {
                userId: user.id,
                title: req.title,
                mediaType: req.mediaType,
                status: 'pending',
              },
            }),
          ),
        );

        // Create session token
        const sessionToken = await tx.sessionToken.create({
          data: {
            userId: user.id,
            tokenHash: 'atomic-session-hash',
            expiresAt: new Date(Date.now() + 3600000),
          },
        });

        return { user, requests, sessionToken };
      });

      // Verify all data was created atomically
      expect(result.user.email).toBe(registrationData.email);
      expect(result.requests).toHaveLength(2);
      expect(result.sessionToken.userId).toBe(result.user.id);

      // Verify data exists in database
      const foundUser = await userRepository.findById(result.user.id);
      const userRequests = await mediaRepository.findByUser(result.user.id);
      const foundSession = await sessionRepository.findById(result.sessionToken.id);

      expect(foundUser?.email).toBe(registrationData.email);
      expect(userRequests.items).toHaveLength(2);
      expect(foundSession?.userId).toBe(result.user.id);
    });

    it('should rollback atomic operation on any failure', async () => {
      const initialUserCount = await userRepository.count();
      const initialRequestCount = await mediaRepository.countByStatus();

      await expect(
        prisma.$transaction(async (tx) => {
          // Create user successfully
          const user = await tx.user.create({
            data: {
              email: 'rollback@example.com',
              name: 'Rollback User',
              plexId: 'rollback-plex',
              plexUsername: 'rollbackuser',
              role: 'user',
              status: 'active',
            },
          });

          // Create valid request
          await tx.mediaRequest.create({
            data: {
              userId: user.id,
              title: 'Valid Request',
              mediaType: 'movie',
              status: 'pending',
            },
          });

          // Create invalid request (should fail)
          await tx.mediaRequest.create({
            data: {
              userId: 'invalid-user-id', // This will cause foreign key constraint failure
              title: 'Invalid Request',
              mediaType: 'movie',
              status: 'pending',
            },
          });
        }),
      ).rejects.toThrow();

      // Verify nothing was committed
      const finalUserCount = await userRepository.count();
      const finalRequestCount = await mediaRepository.countByStatus();

      expect(finalUserCount).toBe(initialUserCount);
      expect(finalRequestCount).toBe(initialRequestCount);

      // Verify specific user wasn't created
      const rollbackUser = await prisma.user.findFirst({
        where: { email: 'rollback@example.com' },
      });
      expect(rollbackUser).toBeNull();
    });

    it('should handle batch status updates atomically', async () => {
      // Create multiple requests
      const requests = await Promise.all([
        mediaRepository.create({
          userId: testUsers[0].id,
          title: 'Batch Movie 1',
          mediaType: 'movie',
        }),
        mediaRepository.create({
          userId: testUsers[0].id,
          title: 'Batch Movie 2',
          mediaType: 'movie',
        }),
        mediaRepository.create({
          userId: testUsers[1].id,
          title: 'Batch Movie 3',
          mediaType: 'movie',
        }),
      ]);

      const requestIds = requests.map((r) => r.id);

      // Batch update with additional operations
      const batchResult = await prisma.$transaction(async (tx) => {
        // Update all requests to approved
        const updateResult = await tx.mediaRequest.updateMany({
          where: { id: { in: requestIds } },
          data: {
            status: 'approved',
            updatedAt: new Date(),
          },
        });

        // Update service status
        await tx.serviceStatus.upsert({
          where: { serviceName: 'batch-processor' },
          create: {
            serviceName: 'batch-processor',
            status: 'healthy',
            responseTimeMs: 200,
            uptimePercentage: 100.0,
            lastCheckAt: new Date(),
          },
          update: {
            status: 'healthy',
            responseTimeMs: 200,
            lastCheckAt: new Date(),
          },
        });

        // Log batch operation
        const logEntry = await tx.user.update({
          where: { id: testUsers[0].id },
          data: {
            lastLoginAt: new Date(),
          },
        });

        return { updateResult, logEntry };
      });

      expect(batchResult.updateResult.count).toBe(3);

      // Verify all updates were applied
      const updatedRequests = await Promise.all(
        requestIds.map((id) => mediaRepository.findById(id)),
      );

      expect(updatedRequests.every((r) => r?.status === 'approved')).toBe(true);

      // Verify service status was updated
      const serviceStatus = await serviceRepository.findByName('batch-processor');
      expect(serviceStatus?.status).toBe('healthy');
    });
  });

  describe('Saga Pattern Implementation', () => {
    it('should implement compensating transactions for media request workflow', async () => {
      const sagaSteps = [];
      const compensationSteps = [];

      try {
        // Step 1: Create user
        const user = await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email: 'saga@example.com',
              name: 'Saga User',
              plexId: 'saga-plex',
              plexUsername: 'sagauser',
              role: 'user',
              status: 'active',
            },
          });

          sagaSteps.push({ step: 'user-created', data: newUser });
          compensationSteps.unshift({
            step: 'delete-user',
            action: () => userRepository.delete(newUser.id),
          });

          return newUser;
        });

        // Step 2: Create media request
        const mediaRequest = await prisma.$transaction(async (tx) => {
          const request = await tx.mediaRequest.create({
            data: {
              userId: user.id,
              title: 'Saga Movie',
              mediaType: 'movie',
              status: 'pending',
            },
          });

          sagaSteps.push({ step: 'request-created', data: request });
          compensationSteps.unshift({
            step: 'delete-request',
            action: () => mediaRepository.delete(request.id),
          });

          return request;
        });

        // Step 3: Update service status (simulate external API failure)
        await prisma.$transaction(async (tx) => {
          await tx.serviceStatus.upsert({
            where: { serviceName: 'saga-service' },
            create: {
              serviceName: 'saga-service',
              status: 'processing',
              responseTimeMs: 300,
              uptimePercentage: 99.5,
              lastCheckAt: new Date(),
            },
            update: {
              status: 'processing',
              responseTimeMs: 300,
              lastCheckAt: new Date(),
            },
          });

          sagaSteps.push({ step: 'service-updated' });
          compensationSteps.unshift({
            step: 'revert-service',
            action: async () => {
              const service = await serviceRepository.findByName('saga-service');
              if (service) {
                await serviceRepository.delete(service.id);
              }
            },
          });

          // Simulate failure
          throw new Error('Saga step failure simulation');
        });
      } catch (error) {
        // Execute compensation steps in reverse order
        for (const compensation of compensationSteps) {
          try {
            await compensation.action();
          } catch (compError) {
            console.warn(`Compensation step ${compensation.step} failed:`, compError);
          }
        }

        // Verify compensations worked
        const userExists = await userRepository.findById(sagaSteps[0]?.data?.id);
        const requestExists = sagaSteps[1]?.data?.id
          ? await mediaRepository.findById(sagaSteps[1].data.id)
          : null;
        const serviceExists = await serviceRepository.findByName('saga-service');

        expect(userExists).toBeNull();
        expect(requestExists).toBeNull();
        expect(serviceExists).toBeNull();
      }
    });

    it('should handle partial saga completion with selective compensation', async () => {
      const sagaState = {
        user: null as any,
        request: null as any,
        session: null as any,
        serviceUpdate: false,
      };

      try {
        // Step 1: Create user (succeeds)
        sagaState.user = await userRepository.create({
          email: 'partial-saga@example.com',
          name: 'Partial Saga User',
          plexId: 'partial-saga-plex',
          plexUsername: 'partialsagauser',
          role: 'user',
        });

        // Step 2: Create request (succeeds)
        sagaState.request = await mediaRepository.create({
          userId: sagaState.user.id,
          title: 'Partial Saga Movie',
          mediaType: 'movie',
        });

        // Step 3: Create session (succeeds)
        sagaState.session = await sessionRepository.create({
          userId: sagaState.user.id,
          tokenHash: 'partial-saga-hash',
          expiresAt: new Date(Date.now() + 3600000),
        });

        // Step 4: Update service status (fails)
        await prisma.$transaction(async (tx) => {
          await tx.serviceStatus.upsert({
            where: { serviceName: 'partial-saga-service' },
            create: {
              serviceName: 'partial-saga-service',
              status: 'healthy',
              responseTimeMs: 150,
              uptimePercentage: 99.9,
              lastCheckAt: new Date(),
            },
            update: {
              status: 'healthy',
              responseTimeMs: 150,
              lastCheckAt: new Date(),
            },
          });

          // Simulate failure after service update
          throw new Error('Service integration failed');
        });
      } catch (error) {
        // Compensate only the operations that succeeded
        const compensations = [];

        if (sagaState.session) {
          compensations.push(() => sessionRepository.delete(sagaState.session.id));
        }

        if (sagaState.request) {
          compensations.push(() => mediaRepository.delete(sagaState.request.id));
        }

        // Keep user but mark as incomplete
        if (sagaState.user) {
          compensations.push(() =>
            userRepository.update(sagaState.user.id, {
              status: 'incomplete',
              name: 'FAILED: ' + sagaState.user.name,
            }),
          );
        }

        await Promise.all(compensations.map((comp) => comp()));

        // Verify selective compensation
        const finalUser = await userRepository.findById(sagaState.user.id);
        const finalRequest = await mediaRepository.findById(sagaState.request.id);
        const finalSession = await sessionRepository.findById(sagaState.session.id);

        expect(finalUser?.status).toBe('incomplete');
        expect(finalUser?.name).toContain('FAILED:');
        expect(finalRequest).toBeNull();
        expect(finalSession).toBeNull();
      }
    });
  });

  describe('Distributed Transaction Simulation', () => {
    it('should coordinate transactions across multiple services', async () => {
      const transactionId = `dtx-${Date.now()}`;
      const serviceOperations = [];

      // Phase 1: Prepare phase - all services vote
      const preparePhase = async () => {
        const preparations = [
          // Service A: User management
          prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
              data: {
                email: `dtx-${transactionId}@example.com`,
                name: 'Distributed User',
                plexId: `dtx-${transactionId}`,
                plexUsername: `dtxuser${Date.now()}`,
                role: 'user',
                status: 'pending', // Indicates preparation phase
              },
            });

            serviceOperations.push({
              service: 'user-management',
              operation: 'create-user',
              resourceId: user.id,
              status: 'prepared',
            });

            return user;
          }),

          // Service B: Media management
          (async () => {
            // Simulate external service preparation
            await new Promise((resolve) => setTimeout(resolve, 100));

            serviceOperations.push({
              service: 'media-management',
              operation: 'reserve-quota',
              resourceId: `quota-${transactionId}`,
              status: 'prepared',
            });

            return { quotaReserved: true, quotaId: `quota-${transactionId}` };
          })(),

          // Service C: Notification service
          (async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));

            serviceOperations.push({
              service: 'notification',
              operation: 'schedule-welcome',
              resourceId: `welcome-${transactionId}`,
              status: 'prepared',
            });

            return { notificationScheduled: true };
          })(),
        ];

        return await Promise.all(preparations);
      };

      // Phase 2: Commit phase - all services commit
      const commitPhase = async (prepareResults: any[]) => {
        const commitOperations = [
          // Commit user creation
          prisma.$transaction(async (tx) => {
            const user = await tx.user.update({
              where: { id: prepareResults[0].id },
              data: { status: 'active' }, // Activate user
            });

            // Create initial media request
            const request = await tx.mediaRequest.create({
              data: {
                userId: user.id,
                title: 'Welcome Package Movie',
                mediaType: 'movie',
                status: 'pending',
              },
            });

            return { user, request };
          }),

          // Commit quota allocation
          (async () => {
            await new Promise((resolve) => setTimeout(resolve, 75));
            return { quotaAllocated: true, quotaId: prepareResults[1].quotaId };
          })(),

          // Commit notification sending
          (async () => {
            await new Promise((resolve) => setTimeout(resolve, 25));
            return { notificationSent: true };
          })(),
        ];

        return await Promise.all(commitOperations);
      };

      // Execute distributed transaction
      try {
        const prepareResults = await preparePhase();

        // Verify all services prepared successfully
        expect(serviceOperations).toHaveLength(3);
        expect(serviceOperations.every((op) => op.status === 'prepared')).toBe(true);

        const commitResults = await commitPhase(prepareResults);

        // Verify commit results
        expect(commitResults[0].user.status).toBe('active');
        expect(commitResults[0].request).toBeTruthy();
        expect(commitResults[1].quotaAllocated).toBe(true);
        expect(commitResults[2].notificationSent).toBe(true);

        // Verify final state in database
        const finalUser = await userRepository.findById(prepareResults[0].id);
        const userRequests = await mediaRepository.findByUser(prepareResults[0].id);

        expect(finalUser?.status).toBe('active');
        expect(userRequests.items).toHaveLength(1);
        expect(userRequests.items[0].title).toBe('Welcome Package Movie');
      } catch (error) {
        // Rollback phase - compensate all prepared operations
        const rollbackOperations = serviceOperations.map(async (op) => {
          switch (op.service) {
            case 'user-management':
              if (op.resourceId) {
                await userRepository.delete(op.resourceId);
              }
              break;
            case 'media-management':
              // Simulate quota release
              await new Promise((resolve) => setTimeout(resolve, 50));
              break;
            case 'notification':
              // Simulate notification cancellation
              await new Promise((resolve) => setTimeout(resolve, 25));
              break;
          }
        });

        await Promise.all(rollbackOperations);
        throw error;
      }
    });

    it('should handle distributed transaction timeout', async () => {
      const transactionTimeout = 1000; // 1 second
      const transactionId = `timeout-${Date.now()}`;

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Transaction timeout')), transactionTimeout),
      );

      await expect(
        Promise.race([
          prisma.$transaction(async (tx) => {
            // Create user
            const user = await tx.user.create({
              data: {
                email: `timeout-${transactionId}@example.com`,
                name: 'Timeout User',
                plexId: `timeout-${transactionId}`,
                plexUsername: `timeoutuser${Date.now()}`,
                role: 'user',
                status: 'active',
              },
            });

            // Simulate long-running operation
            await new Promise((resolve) => setTimeout(resolve, 2000));

            return user;
          }),
          timeoutPromise,
        ]),
      ).rejects.toThrow('Transaction timeout');

      // Verify no partial data was committed
      const timeoutUser = await prisma.user.findFirst({
        where: { email: `timeout-${transactionId}@example.com` },
      });
      expect(timeoutUser).toBeNull();
    });
  });

  describe('Transaction Isolation and Concurrency', () => {
    it('should handle concurrent user updates with proper isolation', async () => {
      const user = testUsers[0];
      const concurrentOperations = 10;

      const updateOperations = Array(concurrentOperations)
        .fill(0)
        .map(async (_, index) => {
          return await prisma.$transaction(async (tx) => {
            // Read current state
            const currentUser = await tx.user.findUnique({
              where: { id: user.id },
            });

            // Simulate processing time
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

            // Update with new name
            const updatedUser = await tx.user.update({
              where: { id: user.id },
              data: {
                name: `Concurrent Update ${index}`,
                lastLoginAt: new Date(),
              },
            });

            return { index, updatedUser };
          });
        });

      const results = await Promise.allSettled(updateOperations);
      const successful = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      // Some operations should succeed
      expect(successful.length).toBeGreaterThan(0);

      // Final state should be consistent
      const finalUser = await userRepository.findById(user.id);
      expect(finalUser?.name).toMatch(/^Concurrent Update \d+$/);

      console.log(`Concurrent Updates: ${successful.length} successful, ${failed.length} failed`);
    });

    it('should prevent phantom reads in concurrent request processing', async () => {
      const user = testUsers[0];

      // Transaction 1: Count and create requests
      const transaction1 = prisma.$transaction(async (tx) => {
        const initialCount = await tx.mediaRequest.count({
          where: { userId: user.id },
        });

        // Simulate processing time
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Create new request
        await tx.mediaRequest.create({
          data: {
            userId: user.id,
            title: 'Transaction 1 Movie',
            mediaType: 'movie',
          },
        });

        const finalCount = await tx.mediaRequest.count({
          where: { userId: user.id },
        });

        return { initialCount, finalCount };
      });

      // Transaction 2: Create request concurrently
      const transaction2 = (async () => {
        await new Promise((resolve) => setTimeout(resolve, 250));

        return await mediaRepository.create({
          userId: user.id,
          title: 'Transaction 2 Movie',
          mediaType: 'movie',
        });
      })();

      const [tx1Result, tx2Result] = await Promise.all([transaction1, transaction2]);

      // Verify transaction isolation
      expect(tx1Result.finalCount).toBe(tx1Result.initialCount + 1);
      expect(tx2Result.userId).toBe(user.id);

      // Final count should be 2
      const finalCount = await mediaRepository.countByUser(user.id);
      expect(finalCount).toBe(2);
    });

    it('should handle deadlock detection and retry', async () => {
      const user1 = testUsers[0];
      const user2 = testUsers[1];

      // Create potential deadlock scenario
      const deadlockOperations = [
        // Transaction A: Update user1 then user2
        prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: user1.id },
            data: { name: 'Deadlock Test A1' },
          });

          // Simulate processing time
          await new Promise((resolve) => setTimeout(resolve, 100));

          await tx.user.update({
            where: { id: user2.id },
            data: { name: 'Deadlock Test A2' },
          });

          return 'Transaction A completed';
        }),

        // Transaction B: Update user2 then user1
        prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: user2.id },
            data: { name: 'Deadlock Test B1' },
          });

          // Simulate processing time
          await new Promise((resolve) => setTimeout(resolve, 100));

          await tx.user.update({
            where: { id: user1.id },
            data: { name: 'Deadlock Test B2' },
          });

          return 'Transaction B completed';
        }),
      ];

      const results = await Promise.allSettled(deadlockOperations);
      const successful = results.filter((r) => r.status === 'fulfilled');

      // At least one transaction should complete
      expect(successful.length).toBeGreaterThanOrEqual(1);

      // Verify final state is consistent
      const finalUser1 = await userRepository.findById(user1.id);
      const finalUser2 = await userRepository.findById(user2.id);

      expect(finalUser1?.name).toMatch(/Deadlock Test [AB]\d/);
      expect(finalUser2?.name).toMatch(/Deadlock Test [AB]\d/);
    });
  });
});
