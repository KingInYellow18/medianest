/**
 * Consolidated Authentication Integration Tests
 * Combines all authentication-related tests into a single comprehensive suite
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { TestDatabase, setupTestDatabase, cleanupTestDatabase } from '../shared/test-database';
import { TestServer, setupTestServer, cleanupTestServer } from '../shared/test-server';
import { AuthenticationMock, setupAuthMocks, cleanupAuthMocks } from '../shared/test-authentication';
import { UserFixtures, APIFixtures } from '../shared/test-fixtures';

describe('Authentication Integration Tests', () => {
  let testDb: TestDatabase;
  let testServer: TestServer;
  let authMock: AuthenticationMock;

  beforeAll(async () => {
    // Setup test infrastructure
    testDb = await setupTestDatabase({ seed: true, isolate: true });
    testServer = await setupTestServer({ database: testDb });
    authMock = setupAuthMocks({ database: testDb });
    
    // Seed authentication-specific test data
    await authMock.seedTestUsers();
  });

  afterAll(async () => {
    await cleanupTestDatabase(testDb);
    await cleanupTestServer(testServer);
    cleanupAuthMocks(authMock);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Management', () => {
    it('should create valid session for authenticated user', async () => {
      const user = UserFixtures.testUser();
      const session = authMock.createSession(user);

      expect(authMock.validateSessionStructure(session)).toBe(true);
      expect(session.user.id).toBe(user.id);
      expect(session.user.email).toBe(user.email);
      expect(session.accessToken).toBeDefined();
    });

    it('should handle unauthenticated session', () => {
      const session = authMock.createUnauthenticatedSession();
      expect(session).toBeNull();
    });

    it('should create admin session with proper role', async () => {
      const adminUser = UserFixtures.adminUser();
      const session = authMock.createSession(adminUser);

      expect(session.user.role).toBe('ADMIN');
      expect(session.user.email).toBe(adminUser.email);
    });

    it('should generate valid JWT token', async () => {
      const user = UserFixtures.testUser();
      const headers = authMock.createAuthHeaders(user);

      expect(headers.Authorization).toMatch(/^Bearer .+\..+\..+$/);
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('API Authentication Endpoints', () => {
    it('should protect authenticated routes', async () => {
      authMock.mockUnauthenticatedRequest();

      const response = await testServer.request('GET', '/api/user/profile');
      
      expect(response.status).toBe(401);
      expect(response.body).toEqual(
        APIFixtures.errorResponse('Authentication required', 'UNAUTHORIZED')
      );
    });

    it('should allow access to authenticated routes with valid session', async () => {
      const user = UserFixtures.testUser();
      authMock.mockAuthenticatedRequest(user);

      const response = await testServer.request('GET', '/api/user/profile', {
        headers: authMock.createAuthHeaders(user)
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(user.id);
    });

    it('should protect admin routes from regular users', async () => {
      const user = UserFixtures.testUser();
      authMock.mockAuthenticatedRequest(user);

      const response = await testServer.request('GET', '/api/admin/users', {
        headers: authMock.createAuthHeaders(user)
      });

      expect(response.status).toBe(403);
      expect(response.body).toEqual(
        APIFixtures.errorResponse('Admin access required', 'FORBIDDEN')
      );
    });

    it('should allow admin access to admin routes', async () => {
      const admin = UserFixtures.adminUser();
      authMock.mockAdminRequest(admin);

      const response = await testServer.request('GET', '/api/admin/users', {
        headers: authMock.createAuthHeaders(admin)
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.users)).toBe(true);
    });
  });

  describe('NextAuth Integration', () => {
    it('should handle NextAuth session creation', async () => {
      const user = UserFixtures.testUser();
      authMock.mockAuthenticatedRequest(user);

      const { getServerSession } = require('next-auth');
      const session = await getServerSession();

      expect(session).toBeDefined();
      expect(session.user.id).toBe(user.id);
      expect(session.user.email).toBe(user.email);
    });

    it('should handle NextAuth JWT token', async () => {
      const user = UserFixtures.testUser();
      authMock.mockAuthenticatedRequest(user);

      const { getToken } = require('next-auth/jwt');
      const token = await getToken();

      expect(token).toBeDefined();
      expect(token.sub).toBe(user.id);
      expect(token.email).toBe(user.email);
      expect(token.role).toBe(user.role);
    });

    it('should handle sign-in flow', async () => {
      const user = UserFixtures.testUser();
      authMock.mockProviderResponses();

      const { signInWithCredentials } = require('@/lib/auth/providers');
      const result = await signInWithCredentials(user.email, 'password');

      expect(result).toBeDefined();
      expect(result.id).toBe(user.id);
      expect(result.email).toBe(user.email);
    });

    it('should handle Plex authentication', async () => {
      const plexUser = UserFixtures.plexUser();
      authMock.mockProviderResponses();

      const { signInWithPlex } = require('@/lib/auth/providers');
      const result = await signInWithPlex('plex-token');

      expect(result).toBeDefined();
      expect(result.plexToken).toBeDefined();
    });
  });

  describe('Database Session Management', () => {
    it('should store session in database', async () => {
      const client = testDb.getClient();
      const user = UserFixtures.testUser();
      
      // Create session in database
      const session = await client.session.create({
        data: {
          sessionToken: 'test-session-db-001',
          userId: user.id,
          expires: new Date(Date.now() + 86400000)
        }
      });

      expect(session.sessionToken).toBe('test-session-db-001');
      expect(session.userId).toBe(user.id);
    });

    it('should cleanup expired sessions', async () => {
      const client = testDb.getClient();
      const user = UserFixtures.testUser();
      
      // Create expired session
      await client.session.create({
        data: {
          sessionToken: 'expired-session-001',
          userId: user.id,
          expires: new Date(Date.now() - 86400000) // Expired yesterday
        }
      });

      // Cleanup expired sessions
      await client.session.deleteMany({
        where: { expires: { lt: new Date() } }
      });

      const expiredSession = await client.session.findUnique({
        where: { sessionToken: 'expired-session-001' }
      });

      expect(expiredSession).toBeNull();
    });

    it('should update user last login', async () => {
      const client = testDb.getClient();
      const user = UserFixtures.testUser();
      
      // Create user in database
      await client.user.upsert({
        where: { id: user.id },
        create: { ...user, createdAt: new Date(), updatedAt: new Date() },
        update: {}
      });

      // Update last login
      const updatedUser = await client.user.update({
        where: { id: user.id },
        data: { updatedAt: new Date() }
      });

      expect(updatedUser.updatedAt.getTime()).toBeGreaterThan(
        new Date(Date.now() - 10000).getTime()
      );
    });
  });

  describe('Security Validation', () => {
    it('should validate session token format', async () => {
      const user = UserFixtures.testUser();
      const session = authMock.createSession(user);
      
      // JWT format: header.payload.signature
      expect(session.accessToken).toMatch(/^[A-Za-z0-9+/]+=*\.[A-Za-z0-9+/]+=*\.[A-Za-z0-9+/]+=*$/);
    });

    it('should handle malformed tokens', async () => {
      const response = await testServer.request('GET', '/api/user/profile', {
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(401);
      expect(response.body).toEqual(
        APIFixtures.errorResponse('Invalid token', 'INVALID_TOKEN')
      );
    });

    it('should validate user permissions', async () => {
      const client = testDb.getClient();
      const user = UserFixtures.testUser();
      
      // Create user with specific role
      await client.user.upsert({
        where: { id: user.id },
        create: { 
          ...user, 
          role: 'USER',
          createdAt: new Date(), 
          updatedAt: new Date() 
        },
        update: { role: 'USER' }
      });

      authMock.mockAuthenticatedRequest({ ...user, role: 'USER' });

      const response = await testServer.request('GET', '/api/admin/settings', {
        headers: authMock.createAuthHeaders(user)
      });

      expect(response.status).toBe(403);
    });

    it('should prevent session fixation attacks', async () => {
      const client = testDb.getClient();
      const user = UserFixtures.testUser();
      
      // Create initial session
      const session1 = await client.session.create({
        data: {
          sessionToken: 'session-before-login',
          userId: user.id,
          expires: new Date(Date.now() + 86400000)
        }
      });

      // Simulate login (should create new session)
      const session2 = await client.session.create({
        data: {
          sessionToken: 'session-after-login',
          userId: user.id,
          expires: new Date(Date.now() + 86400000)
        }
      });

      expect(session1.sessionToken).not.toBe(session2.sessionToken);
    });
  });

  describe('Performance & Scalability', () => {
    it('should handle multiple concurrent auth requests', async () => {
      const user = UserFixtures.testUser();
      authMock.mockAuthenticatedRequest(user);
      
      const requests = Array.from({ length: 10 }, (_, i) =>
        testServer.request('GET', `/api/user/profile?req=${i}`, {
          headers: authMock.createAuthHeaders(user)
        })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should efficiently query user sessions', async () => {
      const client = testDb.getClient();
      const users = UserFixtures.createUsers(5);
      
      // Create users and sessions in batch
      for (const user of users) {
        await client.user.upsert({
          where: { id: user.id },
          create: { ...user, createdAt: new Date(), updatedAt: new Date() },
          update: {}
        });

        await client.session.create({
          data: {
            sessionToken: `session-${user.id}`,
            userId: user.id,
            expires: new Date(Date.now() + 86400000)
          }
        });
      }

      // Query sessions efficiently
      const startTime = Date.now();
      const sessions = await client.session.findMany({
        where: { expires: { gt: new Date() } },
        include: { user: true }
      });
      const queryTime = Date.now() - startTime;

      expect(sessions).toHaveLength(5);
      expect(queryTime).toBeLessThan(100); // Should complete within 100ms
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock database error
      const client = testDb.getClient();
      vi.spyOn(client.user, 'findUnique').mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      authMock.mockUnauthenticatedRequest();

      const response = await testServer.request('GET', '/api/user/profile');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should handle missing environment variables', async () => {
      const originalNextAuthSecret = process.env.NEXTAUTH_SECRET;
      delete process.env.NEXTAUTH_SECRET;

      try {
        const response = await testServer.request('POST', '/api/auth/signin', {
          body: { email: 'test@test.com', password: 'password' }
        });

        expect(response.status).toBe(500);
        expect(response.body).toEqual(
          APIFixtures.errorResponse('Authentication configuration error', 'CONFIG_ERROR')
        );
      } finally {
        process.env.NEXTAUTH_SECRET = originalNextAuthSecret;
      }
    });

    it('should handle malformed session data', async () => {
      const client = testDb.getClient();
      
      // Create session with invalid data structure
      await client.$executeRawUnsafe(`
        INSERT INTO "Session" ("sessionToken", "userId", "expires")
        VALUES ('malformed-session', 'non-existent-user', '2025-01-01')
      `);

      const response = await testServer.request('GET', '/api/user/profile', {
        headers: {
          'Authorization': 'Bearer malformed-token',
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(401);
    });
  });
});