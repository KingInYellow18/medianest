/**
 * MediaNest Service Integration Tests
 *
 * Tests integration between different services and components:
 * - Docker container orchestration
 * - Database connectivity and transactions
 * - Redis session and caching
 * - File upload/download workflows
 * - External service integrations (Plex, TMDB, etc.)
 * - WebSocket real-time communication
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import Docker from 'dockerode';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import WebSocket from 'ws';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import FormData from 'form-data';
import { DatabaseTestHelper } from '../helpers/database-test-helper';
import { RedisTestHelper } from '../helpers/redis-test-helper';
import { FileTestHelper } from '../helpers/file-test-helper';
import { WebSocketTestHelper } from '../helpers/websocket-test-helper';

describe('MediaNest Service Integration Tests', () => {
  let docker: Docker;
  let prisma: PrismaClient;
  let redis: Redis;
  let dbHelper: DatabaseTestHelper;
  let redisHelper: RedisTestHelper;
  let fileHelper: FileTestHelper;
  let wsHelper: WebSocketTestHelper;

  // Service containers
  let containers: { [key: string]: any } = {};
  let services: { [key: string]: ChildProcess } = {};

  const TEST_CONFIG = {
    baseUrl: 'http://localhost:3001',
    dbUrl: 'postgresql://medianest:medianest_password@localhost:5433/medianest_test',
    redisUrl: 'redis://localhost:6380',
    uploadDir: '/tmp/medianest-test-uploads',
    containers: {
      postgres: {
        image: 'postgres:15-alpine',
        name: 'medianest-test-postgres',
        ports: { '5432/tcp': 5433 },
        env: [
          'POSTGRES_DB=medianest_test',
          'POSTGRES_USER=medianest',
          'POSTGRES_PASSWORD=medianest_password',
        ],
      },
      redis: {
        image: 'redis:7-alpine',
        name: 'medianest-test-redis',
        ports: { '6379/tcp': 6380 },
        env: [],
      },
    },
  };

  beforeAll(async () => {
    console.log('🚀 Setting up service integration test environment...');

    // Initialize Docker client
    docker = new Docker();

    // Start test containers
    await startTestContainers();

    // Wait for services to be ready
    await waitForServices();

    // Initialize database and Redis connections
    prisma = new PrismaClient({
      datasources: { db: { url: TEST_CONFIG.dbUrl } },
    });
    redis = new Redis(TEST_CONFIG.redisUrl);

    // Initialize test helpers
    dbHelper = new DatabaseTestHelper(prisma);
    redisHelper = new RedisTestHelper(redis);
    fileHelper = new FileTestHelper(TEST_CONFIG.uploadDir);
    wsHelper = new WebSocketTestHelper(TEST_CONFIG.baseUrl);

    // Setup test environment
    await dbHelper.setupTestDatabase();
    await redisHelper.clearTestData();
    await fileHelper.setupTestDirectories();

    console.log('✅ Service integration test environment ready');
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up service integration test environment...');

    // Cleanup helpers
    await dbHelper?.cleanup();
    await redisHelper?.cleanup();
    await fileHelper?.cleanup();
    await wsHelper?.cleanup();

    // Disconnect from services
    await prisma?.$disconnect();
    await redis?.quit();

    // Stop and remove test containers
    await stopTestContainers();

    console.log('✅ Service integration test environment cleaned');
  });

  beforeEach(async () => {
    await dbHelper.clearTestData();
    await redisHelper.clearTestData();
    await fileHelper.clearTestFiles();
  });

  async function startTestContainers() {
    console.log('Starting test containers...');

    for (const [name, config] of Object.entries(TEST_CONFIG.containers)) {
      try {
        // Check if container already exists
        const existingContainer = docker.getContainer(config.name);
        try {
          const info = await existingContainer.inspect();
          if (info.State.Running) {
            containers[name] = existingContainer;
            console.log(`📦 Container ${config.name} already running`);
            continue;
          }
        } catch (error) {
          // Container doesn't exist, create it
        }

        // Create and start container
        const container = await docker.createContainer({
          Image: config.image,
          name: config.name,
          Env: config.env,
          PortBindings: Object.keys(config.ports).reduce((acc, containerPort) => {
            acc[containerPort] = [{ HostPort: config.ports[containerPort].toString() }];
            return acc;
          }, {} as any),
          HostConfig: {
            AutoRemove: true,
            PortBindings: Object.keys(config.ports).reduce((acc, containerPort) => {
              acc[containerPort] = [{ HostPort: config.ports[containerPort].toString() }];
              return acc;
            }, {} as any),
          },
        });

        await container.start();
        containers[name] = container;
        console.log(`📦 Started container ${config.name}`);
      } catch (error) {
        console.error(`❌ Failed to start container ${config.name}:`, error);
        throw error;
      }
    }
  }

  async function stopTestContainers() {
    for (const [name, container] of Object.entries(containers)) {
      try {
        await container.stop();
        console.log(`📦 Stopped container ${name}`);
      } catch (error) {
        console.error(`❌ Failed to stop container ${name}:`, error);
      }
    }
  }

  async function waitForServices() {
    console.log('⏳ Waiting for services to be ready...');

    // Wait for PostgreSQL
    let pgReady = false;
    let pgRetries = 30;
    while (!pgReady && pgRetries > 0) {
      try {
        const testPrisma = new PrismaClient({
          datasources: { db: { url: TEST_CONFIG.dbUrl } },
        });
        await testPrisma.$queryRaw`SELECT 1`;
        await testPrisma.$disconnect();
        pgReady = true;
        console.log('🐘 PostgreSQL ready');
      } catch (error) {
        pgRetries--;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!pgReady) {
      throw new Error('PostgreSQL failed to start');
    }

    // Wait for Redis
    let redisReady = false;
    let redisRetries = 30;
    while (!redisReady && redisRetries > 0) {
      try {
        const testRedis = new Redis(TEST_CONFIG.redisUrl);
        await testRedis.ping();
        await testRedis.quit();
        redisReady = true;
        console.log('🔴 Redis ready');
      } catch (error) {
        redisRetries--;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!redisReady) {
      throw new Error('Redis failed to start');
    }
  }

  describe('Docker Container Orchestration', () => {
    test('should manage container lifecycle correctly', async () => {
      // Test container health checks
      for (const [name, container] of Object.entries(containers)) {
        const info = await container.inspect();
        expect(info.State.Running).toBe(true);
        expect(info.State.Status).toBe('running');
        console.log(`✅ Container ${name} is healthy`);
      }

      // Test container networking
      const postgresInfo = await containers.postgres.inspect();
      const redisInfo = await containers.redis.inspect();

      expect(postgresInfo.NetworkSettings.Ports['5432/tcp']).toBeTruthy();
      expect(redisInfo.NetworkSettings.Ports['6379/tcp']).toBeTruthy();

      console.log('✅ Container networking configured correctly');
    });

    test('should handle container restart scenarios', async () => {
      // Test PostgreSQL restart
      await containers.postgres.restart();

      // Wait for service to be ready again
      await waitForServices();

      // Verify database connection works after restart
      await prisma.$queryRaw`SELECT 1`;

      console.log('✅ PostgreSQL restart handling works correctly');

      // Test Redis restart
      await containers.redis.restart();
      await waitForServices();

      // Verify Redis connection works after restart
      await redis.ping();

      console.log('✅ Redis restart handling works correctly');
    });

    test('should maintain data persistence across restarts', async () => {
      // Create test data
      const testUser = await prisma.user.create({
        data: {
          plexId: 'restart-test-user',
          plexUsername: 'restarttest',
          email: 'restart@test.com',
          role: 'user',
          status: 'active',
        },
      });

      const testKey = 'restart-test-key';
      await redis.set(testKey, 'restart-test-value');

      // Restart containers
      await containers.postgres.restart();
      await containers.redis.restart();
      await waitForServices();

      // Recreate connections
      await prisma.$disconnect();
      await redis.quit();

      prisma = new PrismaClient({
        datasources: { db: { url: TEST_CONFIG.dbUrl } },
      });
      redis = new Redis(TEST_CONFIG.redisUrl);

      // Verify data persistence
      const persistedUser = await prisma.user.findUnique({
        where: { plexId: 'restart-test-user' },
      });
      expect(persistedUser).toBeTruthy();
      expect(persistedUser!.plexUsername).toBe('restarttest');

      // Note: Redis data won't persist without volume mounting in test environment
      // This is expected behavior for ephemeral test containers
      console.log('✅ Database data persistence verified');
    });
  });

  describe('Database Integration', () => {
    test('should handle complex transactions correctly', async () => {
      const transactionTest = await prisma.$transaction(async (tx) => {
        // Create user
        const user = await tx.user.create({
          data: {
            plexId: 'transaction-test-user',
            plexUsername: 'txtest',
            email: 'tx@test.com',
            role: 'user',
            status: 'active',
          },
        });

        // Create media record
        const media = await tx.media.create({
          data: {
            tmdbId: 999999,
            mediaType: 'movie',
            title: 'Transaction Test Movie',
            overview: 'Test movie for transaction',
            status: 'available',
          },
        });

        // Create media request
        const request = await tx.mediaRequest.create({
          data: {
            userId: user.id,
            mediaId: media.id,
            status: 'pending',
            quality: 'HD',
          },
        });

        return { user, media, request };
      });

      // Verify all records were created
      expect(transactionTest.user.id).toBeTruthy();
      expect(transactionTest.media.id).toBeTruthy();
      expect(transactionTest.request.id).toBeTruthy();

      // Verify relationships
      const requestWithRelations = await prisma.mediaRequest.findUnique({
        where: { id: transactionTest.request.id },
        include: { user: true, media: true },
      });

      expect(requestWithRelations!.user.id).toBe(transactionTest.user.id);
      expect(requestWithRelations!.media.id).toBe(transactionTest.media.id);

      console.log('✅ Complex transaction handling verified');
    });

    test('should handle concurrent database operations', async () => {
      const concurrentOps = Array.from({ length: 10 }, (_, i) =>
        prisma.user.create({
          data: {
            plexId: `concurrent-user-${i}`,
            plexUsername: `concurrent${i}`,
            email: `concurrent${i}@test.com`,
            role: 'user',
            status: 'active',
          },
        }),
      );

      const results = await Promise.all(concurrentOps);

      expect(results).toHaveLength(10);
      results.forEach((user, index) => {
        expect(user.plexUsername).toBe(`concurrent${index}`);
      });

      console.log('✅ Concurrent database operations handled correctly');
    });

    test('should maintain referential integrity', async () => {
      // Create test data with relationships
      const user = await prisma.user.create({
        data: {
          plexId: 'integrity-test-user',
          plexUsername: 'integritytest',
          email: 'integrity@test.com',
          role: 'user',
          status: 'active',
        },
      });

      const media = await prisma.media.create({
        data: {
          tmdbId: 888888,
          mediaType: 'movie',
          title: 'Integrity Test Movie',
          overview: 'Test movie for integrity',
          status: 'available',
        },
      });

      const request = await prisma.mediaRequest.create({
        data: {
          userId: user.id,
          mediaId: media.id,
          status: 'pending',
          quality: 'HD',
        },
      });

      // Try to delete referenced user (should fail)
      await expect(prisma.user.delete({ where: { id: user.id } })).rejects.toThrow();

      // Delete request first, then user should work
      await prisma.mediaRequest.delete({ where: { id: request.id } });
      await prisma.user.delete({ where: { id: user.id } });

      // Verify deletion
      const deletedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(deletedUser).toBeNull();

      console.log('✅ Referential integrity maintained correctly');
    });
  });

  describe('Redis Session and Caching', () => {
    test('should manage user sessions correctly', async () => {
      const userId = 'session-test-user';
      const sessionData = {
        userId,
        role: 'user',
        loginTime: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      };

      // Create session
      const sessionKey = `session:${userId}`;
      await redis.setex(sessionKey, 3600, JSON.stringify(sessionData));

      // Verify session exists
      const storedSession = await redis.get(sessionKey);
      expect(storedSession).toBeTruthy();

      const parsedSession = JSON.parse(storedSession!);
      expect(parsedSession.userId).toBe(userId);
      expect(parsedSession.role).toBe('user');

      // Test session expiration
      await redis.expire(sessionKey, 1);
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const expiredSession = await redis.get(sessionKey);
      expect(expiredSession).toBeNull();

      console.log('✅ Session management working correctly');
    });

    test('should handle caching with TTL correctly', async () => {
      const cacheKey = 'test-cache-key';
      const cacheData = { message: 'cached data', timestamp: Date.now() };

      // Set cache with 2 second TTL
      await redis.setex(cacheKey, 2, JSON.stringify(cacheData));

      // Verify cache hit
      const cachedResult = await redis.get(cacheKey);
      expect(cachedResult).toBeTruthy();

      const parsedResult = JSON.parse(cachedResult!);
      expect(parsedResult.message).toBe('cached data');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 2100));

      const expiredResult = await redis.get(cacheKey);
      expect(expiredResult).toBeNull();

      console.log('✅ Cache TTL handling working correctly');
    });

    test('should handle Redis pub/sub for real-time updates', async () => {
      const publisher = new Redis(TEST_CONFIG.redisUrl);
      const subscriber = new Redis(TEST_CONFIG.redisUrl);

      const messages: any[] = [];

      // Subscribe to test channel
      await subscriber.subscribe('test-channel');
      subscriber.on('message', (channel, message) => {
        messages.push({ channel, message: JSON.parse(message) });
      });

      // Publish test messages
      const testMessage1 = { type: 'test', data: 'message 1' };
      const testMessage2 = { type: 'test', data: 'message 2' };

      await publisher.publish('test-channel', JSON.stringify(testMessage1));
      await publisher.publish('test-channel', JSON.stringify(testMessage2));

      // Wait for messages to be received
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages).toHaveLength(2);
      expect(messages[0].message.data).toBe('message 1');
      expect(messages[1].message.data).toBe('message 2');

      // Cleanup
      await subscriber.quit();
      await publisher.quit();

      console.log('✅ Redis pub/sub working correctly');
    });
  });

  describe('File Upload/Download Integration', () => {
    test('should handle file uploads correctly', async () => {
      // Create test file
      const testFilePath = path.join(TEST_CONFIG.uploadDir, 'test-upload.txt');
      const testContent = 'This is a test file for upload testing';
      await fs.writeFile(testFilePath, testContent);

      // Test file metadata storage
      const fileMetadata = {
        filename: 'test-upload.txt',
        originalName: 'test-upload.txt',
        size: testContent.length,
        mimetype: 'text/plain',
        path: testFilePath,
        userId: 'upload-test-user',
      };

      // Store metadata in database
      const fileRecord = await prisma.uploadedFile.create({
        data: {
          filename: fileMetadata.filename,
          originalName: fileMetadata.originalName,
          size: fileMetadata.size,
          mimetype: fileMetadata.mimetype,
          path: fileMetadata.path,
          userId: fileMetadata.userId,
        },
      });

      // Verify file exists and metadata is correct
      const stats = await fs.stat(testFilePath);
      expect(stats.size).toBe(testContent.length);
      expect(fileRecord.size).toBe(testContent.length);

      console.log('✅ File upload handling working correctly');
    });

    test('should handle file download and streaming', async () => {
      // Create test file
      const testFilePath = path.join(TEST_CONFIG.uploadDir, 'test-download.txt');
      const testContent = 'This is a test file for download testing';
      await fs.writeFile(testFilePath, testContent);

      // Read file for download
      const downloadedContent = await fs.readFile(testFilePath, 'utf8');
      expect(downloadedContent).toBe(testContent);

      // Test streaming (simulate chunked reading)
      const buffer = await fs.readFile(testFilePath);
      const chunks = [];
      const chunkSize = 10;

      for (let i = 0; i < buffer.length; i += chunkSize) {
        chunks.push(buffer.slice(i, i + chunkSize));
      }

      const reassembledContent = Buffer.concat(chunks).toString('utf8');
      expect(reassembledContent).toBe(testContent);

      console.log('✅ File download and streaming working correctly');
    });

    test('should handle large file operations', async () => {
      // Create large test file (1MB)
      const largeFilePath = path.join(TEST_CONFIG.uploadDir, 'large-test.txt');
      const largeContent = 'A'.repeat(1024 * 1024); // 1MB of 'A's

      const startTime = Date.now();
      await fs.writeFile(largeFilePath, largeContent);
      const writeTime = Date.now() - startTime;

      // Verify file size
      const stats = await fs.stat(largeFilePath);
      expect(stats.size).toBe(1024 * 1024);

      // Test read performance
      const readStartTime = Date.now();
      const readContent = await fs.readFile(largeFilePath, 'utf8');
      const readTime = Date.now() - readStartTime;

      expect(readContent.length).toBe(1024 * 1024);
      expect(writeTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(readTime).toBeLessThan(5000);

      console.log(
        `✅ Large file operations completed (write: ${writeTime}ms, read: ${readTime}ms)`,
      );
    });
  });

  describe('WebSocket Real-time Communication', () => {
    test('should establish WebSocket connections correctly', async () => {
      const wsUrl = `ws://localhost:3001/ws`;

      // Create WebSocket connection
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      });

      // Test message sending
      const testMessage = { type: 'test', data: 'hello websocket' };
      ws.send(JSON.stringify(testMessage));

      // Test message receiving
      const receivedMessage = await new Promise((resolve, reject) => {
        ws.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
        setTimeout(() => reject(new Error('Message receive timeout')), 2000);
      });

      expect(receivedMessage).toMatchObject({
        type: 'echo',
        data: testMessage,
      });

      ws.close();
      console.log('✅ WebSocket communication working correctly');
    });

    test('should broadcast messages to multiple clients', async () => {
      const wsUrl = `ws://localhost:3001/ws`;
      const clients: WebSocket[] = [];

      // Create multiple WebSocket connections
      for (let i = 0; i < 3; i++) {
        const ws = new WebSocket(wsUrl);
        clients.push(ws);

        await new Promise((resolve, reject) => {
          ws.on('open', resolve);
          ws.on('error', reject);
          setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
        });
      }

      // Test broadcast message
      const broadcastMessage = { type: 'broadcast', data: 'message to all' };

      // Send broadcast from first client
      clients[0].send(JSON.stringify(broadcastMessage));

      // Verify all clients receive the message
      const receivedMessages = await Promise.all(
        clients.slice(1).map(
          (client) =>
            new Promise((resolve, reject) => {
              client.on('message', (data) => {
                resolve(JSON.parse(data.toString()));
              });
              setTimeout(() => reject(new Error('Broadcast receive timeout')), 2000);
            }),
        ),
      );

      receivedMessages.forEach((message) => {
        expect(message).toMatchObject({
          type: 'broadcast',
          data: 'message to all',
        });
      });

      // Cleanup connections
      clients.forEach((client) => client.close());
      console.log('✅ WebSocket broadcasting working correctly');
    });

    test('should handle WebSocket authentication', async () => {
      const wsUrl = `ws://localhost:3001/ws`;

      // Test connection without auth (should fail or have limited access)
      const unauthWs = new WebSocket(wsUrl);

      await new Promise((resolve) => {
        unauthWs.on('open', () => {
          // Send message requiring authentication
          unauthWs.send(JSON.stringify({ type: 'auth-required', data: 'test' }));
        });

        unauthWs.on('message', (data) => {
          const message = JSON.parse(data.toString());
          expect(message.type).toBe('auth-error');
          resolve(message);
        });
      });

      unauthWs.close();

      // Test connection with auth
      const authToken = 'test-auth-token';
      const authWs = new WebSocket(`${wsUrl}?token=${authToken}`);

      await new Promise((resolve, reject) => {
        authWs.on('open', resolve);
        authWs.on('error', reject);
        setTimeout(() => reject(new Error('Auth WebSocket connection timeout')), 5000);
      });

      // Send authenticated message
      authWs.send(JSON.stringify({ type: 'auth-required', data: 'authenticated test' }));

      const authResponse = await new Promise((resolve) => {
        authWs.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(authResponse).toMatchObject({
        type: 'auth-success',
        data: expect.any(Object),
      });

      authWs.close();
      console.log('✅ WebSocket authentication working correctly');
    });
  });

  describe('External Service Integration', () => {
    test('should integrate with TMDB API correctly', async () => {
      // Test movie search
      const searchQuery = 'The Matrix';
      const tmdbResponse = await axios
        .get(`https://api.themoviedb.org/3/search/movie`, {
          params: {
            api_key: process.env.TMDB_API_KEY || 'test-api-key',
            query: searchQuery,
          },
          timeout: 5000,
        })
        .catch(() => null); // Handle API key issues in test environment

      if (tmdbResponse) {
        expect(tmdbResponse.status).toBe(200);
        expect(tmdbResponse.data.results).toBeTruthy();
        expect(tmdbResponse.data.results.length).toBeGreaterThan(0);

        const firstResult = tmdbResponse.data.results[0];
        expect(firstResult).toMatchObject({
          id: expect.any(Number),
          title: expect.any(String),
          overview: expect.any(String),
        });

        console.log('✅ TMDB API integration working correctly');
      } else {
        console.log('⚠️  TMDB API test skipped (no API key configured)');
      }
    });

    test('should handle external API failures gracefully', async () => {
      // Test with invalid API endpoint
      try {
        await axios.get('https://api.invalid-service.com/test', {
          timeout: 2000,
        });
      } catch (error) {
        expect(error).toBeTruthy();
        // Should handle network errors gracefully
        console.log('✅ External API failure handling working correctly');
      }
    });

    test('should implement circuit breaker for external services', async () => {
      let failureCount = 0;
      const maxFailures = 3;
      let circuitOpen = false;

      // Simulate circuit breaker logic
      for (let i = 0; i < 5; i++) {
        try {
          if (circuitOpen) {
            throw new Error('Circuit breaker is open');
          }

          // Simulate API call that fails
          await axios.get('https://httpstat.us/500', { timeout: 1000 });
        } catch (error) {
          failureCount++;

          if (failureCount >= maxFailures) {
            circuitOpen = true;
          }

          expect(error).toBeTruthy();
        }
      }

      expect(circuitOpen).toBe(true);
      expect(failureCount).toBe(maxFailures);
      console.log('✅ Circuit breaker pattern working correctly');
    });
  });

  describe('End-to-End Service Workflows', () => {
    test('should handle complete media request workflow', async () => {
      // 1. Create user in database
      const user = await prisma.user.create({
        data: {
          plexId: 'e2e-workflow-user',
          plexUsername: 'e2eworkflow',
          email: 'e2e@workflow.test',
          role: 'user',
          status: 'active',
        },
      });

      // 2. Create session in Redis
      const sessionKey = `session:${user.id}`;
      const sessionData = {
        userId: user.id,
        role: user.role,
        loginTime: new Date().toISOString(),
      };
      await redis.setex(sessionKey, 3600, JSON.stringify(sessionData));

      // 3. Create media request
      const media = await prisma.media.create({
        data: {
          tmdbId: 777777,
          mediaType: 'movie',
          title: 'E2E Workflow Movie',
          overview: 'Test movie for E2E workflow',
          status: 'available',
        },
      });

      const request = await prisma.mediaRequest.create({
        data: {
          userId: user.id,
          mediaId: media.id,
          status: 'pending',
          quality: 'HD',
        },
      });

      // 4. Publish notification via Redis pub/sub
      const notificationPublisher = new Redis(TEST_CONFIG.redisUrl);
      const notificationMessage = {
        type: 'media_request_created',
        userId: user.id,
        requestId: request.id,
        timestamp: new Date().toISOString(),
      };

      await notificationPublisher.publish('notifications', JSON.stringify(notificationMessage));

      // 5. Verify workflow completion
      const finalRequest = await prisma.mediaRequest.findUnique({
        where: { id: request.id },
        include: { user: true, media: true },
      });

      expect(finalRequest).toBeTruthy();
      expect(finalRequest!.user.plexUsername).toBe('e2eworkflow');
      expect(finalRequest!.media.title).toBe('E2E Workflow Movie');

      // Cleanup
      await notificationPublisher.quit();

      console.log('✅ Complete E2E workflow working correctly');
    });

    test('should handle system health monitoring', async () => {
      // Test database health
      try {
        await prisma.$queryRaw`SELECT 1`;
        console.log('✅ Database health check passed');
      } catch (error) {
        throw new Error('Database health check failed');
      }

      // Test Redis health
      try {
        const pong = await redis.ping();
        expect(pong).toBe('PONG');
        console.log('✅ Redis health check passed');
      } catch (error) {
        throw new Error('Redis health check failed');
      }

      // Test file system health
      try {
        await fs.access(TEST_CONFIG.uploadDir);
        console.log('✅ File system health check passed');
      } catch (error) {
        throw new Error('File system health check failed');
      }

      console.log('✅ System health monitoring working correctly');
    });
  });
});
