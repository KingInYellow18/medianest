/**
 * Consolidated API Integration Tests
 * Comprehensive testing of all API endpoints with real database interactions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { TestDatabase, setupTestDatabase, cleanupTestDatabase } from '../shared/test-database';
import { TestServer, setupTestServer, cleanupTestServer } from '../shared/test-server';
import { AuthenticationMock, setupAuthMocks, cleanupAuthMocks } from '../shared/test-authentication';
import { UserFixtures, MediaFixtures, APIFixtures, TestScenarios } from '../shared/test-fixtures';

describe('API Integration Tests', () => {
  let testDb: TestDatabase;
  let testServer: TestServer;
  let authMock: AuthenticationMock;

  beforeAll(async () => {
    // Setup test infrastructure
    testDb = await setupTestDatabase({ seed: true, isolate: true });
    testServer = await setupTestServer({ 
      database: testDb,
      routes: [
        { path: '/api', handler: require('../../backend/src/routes') }
      ]
    });
    authMock = setupAuthMocks({ database: testDb });
    
    // Seed test data
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

  describe('User Management APIs', () => {
    it('should get user profile', async () => {
      const user = UserFixtures.testUser();
      authMock.mockAuthenticatedRequest(user);

      const response = await testServer.request('GET', '/api/user/profile', {
        headers: authMock.createAuthHeaders(user)
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          user: expect.objectContaining({
            id: user.id,
            name: user.name,
            email: user.email
          })
        }
      });
    });

    it('should update user profile', async () => {
      const user = UserFixtures.testUser();
      authMock.mockAuthenticatedRequest(user);
      
      const updateData = { name: 'Updated Name', image: 'new-image.jpg' };

      const response = await testServer.request('PUT', '/api/user/profile', {
        headers: authMock.createAuthHeaders(user),
        body: updateData
      });

      expect(response.status).toBe(200);
      expect(response.body.data.user.name).toBe(updateData.name);
      expect(response.body.data.user.image).toBe(updateData.image);
    });

    it('should get user preferences', async () => {
      const user = UserFixtures.testUser();
      authMock.mockAuthenticatedRequest(user);

      const response = await testServer.request('GET', '/api/user/preferences', {
        headers: authMock.createAuthHeaders(user)
      });

      expect(response.status).toBe(200);
      expect(response.body.data.preferences).toEqual(
        expect.objectContaining({
          theme: expect.any(String),
          language: expect.any(String),
          autoPlay: expect.any(Boolean)
        })
      );
    });

    it('should update user preferences', async () => {
      const user = UserFixtures.testUser();
      authMock.mockAuthenticatedRequest(user);
      
      const preferences = { theme: 'light', autoPlay: false, quality: '4K' };

      const response = await testServer.request('PUT', '/api/user/preferences', {
        headers: authMock.createAuthHeaders(user),
        body: preferences
      });

      expect(response.status).toBe(200);
      expect(response.body.data.preferences).toEqual(
        expect.objectContaining(preferences)
      );
    });

    it('should delete user account', async () => {
      const user = UserFixtures.testUser();
      const client = testDb.getClient();
      
      // Create user in database
      await client.user.create({
        data: { ...user, createdAt: new Date(), updatedAt: new Date() }
      });
      
      authMock.mockAuthenticatedRequest(user);

      const response = await testServer.request('DELETE', '/api/user/account', {
        headers: authMock.createAuthHeaders(user)
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verify user was deleted
      const deletedUser = await client.user.findUnique({
        where: { id: user.id }
      });
      expect(deletedUser).toBeNull();
    });
  });

  describe('Media Management APIs', () => {
    it('should list user media', async () => {
      const scenario = TestScenarios.activeUser();
      const client = testDb.getClient();
      
      // Create test data
      await client.user.create({
        data: { ...scenario.user, createdAt: new Date(), updatedAt: new Date() }
      });
      
      for (const movie of scenario.movies) {
        await client.media.create({
          data: { ...movie, addedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }
        });
      }
      
      authMock.mockAuthenticatedRequest(scenario.user);

      const response = await testServer.request('GET', '/api/media', {
        headers: authMock.createAuthHeaders(scenario.user),
        query: { page: '1', limit: '10' }
      });

      expect(response.status).toBe(200);
      expect(response.body.data.items).toHaveLength(scenario.movies.length);
      expect(response.body.data.pagination).toEqual(
        expect.objectContaining({
          page: 1,
          limit: 10,
          total: scenario.movies.length
        })
      );
    });

    it('should get media details', async () => {
      const movie = MediaFixtures.testMovie();
      const user = UserFixtures.testUser();
      const client = testDb.getClient();
      
      await client.media.create({
        data: { ...movie, addedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }
      });
      
      authMock.mockAuthenticatedRequest(user);

      const response = await testServer.request('GET', `/api/media/${movie.plexId}`, {
        headers: authMock.createAuthHeaders(user)
      });

      expect(response.status).toBe(200);
      expect(response.body.data.media).toEqual(
        expect.objectContaining({
          plexId: movie.plexId,
          title: movie.title,
          type: movie.type
        })
      );
    });

    it('should search media', async () => {
      const movies = MediaFixtures.createMovies(5);
      const user = UserFixtures.testUser();
      const client = testDb.getClient();
      
      for (const movie of movies) {
        await client.media.create({
          data: { ...movie, addedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }
        });
      }
      
      authMock.mockAuthenticatedRequest(user);

      const response = await testServer.request('GET', '/api/media/search', {
        headers: authMock.createAuthHeaders(user),
        query: { q: 'Test Movie', type: 'movie' }
      });

      expect(response.status).toBe(200);
      expect(response.body.data.results.length).toBeGreaterThan(0);
      expect(response.body.data.results[0].title).toContain('Test Movie');
    });

    it('should update media rating', async () => {
      const movie = MediaFixtures.testMovie();
      const user = UserFixtures.testUser();
      const client = testDb.getClient();
      
      await client.user.create({
        data: { ...user, createdAt: new Date(), updatedAt: new Date() }
      });
      await client.media.create({
        data: { ...movie, addedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }
      });
      
      authMock.mockAuthenticatedRequest(user);

      const response = await testServer.request('PUT', `/api/media/${movie.plexId}/rating`, {
        headers: authMock.createAuthHeaders(user),
        body: { rating: 9.5 }
      });

      expect(response.status).toBe(200);
      expect(response.body.data.userMedia.rating).toBe(9.5);
    });

    it('should mark media as favorite', async () => {
      const movie = MediaFixtures.testMovie();
      const user = UserFixtures.testUser();
      const client = testDb.getClient();
      
      await client.user.create({
        data: { ...user, createdAt: new Date(), updatedAt: new Date() }
      });
      await client.media.create({
        data: { ...movie, addedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }
      });
      
      authMock.mockAuthenticatedRequest(user);

      const response = await testServer.request('POST', `/api/media/${movie.plexId}/favorite`, {
        headers: authMock.createAuthHeaders(user)
      });

      expect(response.status).toBe(200);
      expect(response.body.data.userMedia.favorite).toBe(true);
    });
  });

  describe('Watch History APIs', () => {
    it('should get user watch history', async () => {
      const scenario = TestScenarios.activeUser();
      const client = testDb.getClient();
      
      // Create test data
      await client.user.create({
        data: { ...scenario.user, createdAt: new Date(), updatedAt: new Date() }
      });
      
      for (const movie of scenario.movies) {
        await client.media.create({
          data: { ...movie, addedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }
        });
      }
      
      for (const history of scenario.watchHistory) {
        await client.watchHistory.create({
          data: { ...history, createdAt: new Date(), updatedAt: new Date() }
        });
      }
      
      authMock.mockAuthenticatedRequest(scenario.user);

      const response = await testServer.request('GET', '/api/user/watch-history', {
        headers: authMock.createAuthHeaders(scenario.user),
        query: { page: '1', limit: '10' }
      });

      expect(response.status).toBe(200);
      expect(response.body.data.items.length).toBeGreaterThan(0);
      expect(response.body.data.items[0]).toEqual(
        expect.objectContaining({
          mediaId: expect.any(String),
          watchedAt: expect.any(String),
          progress: expect.any(Number)
        })
      );
    });

    it('should update watch progress', async () => {
      const movie = MediaFixtures.testMovie();
      const user = UserFixtures.testUser();
      const client = testDb.getClient();
      
      await client.user.create({
        data: { ...user, createdAt: new Date(), updatedAt: new Date() }
      });
      await client.media.create({
        data: { ...movie, addedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }
      });
      
      authMock.mockAuthenticatedRequest(user);

      const response = await testServer.request('PUT', `/api/media/${movie.plexId}/progress`, {
        headers: authMock.createAuthHeaders(user),
        body: { 
          progress: 0.75,
          duration: 7200000,
          sessionId: 'test-session-001'
        }
      });

      expect(response.status).toBe(200);
      expect(response.body.data.userMedia.progress).toBe(0.75);
      expect(response.body.data.watchHistory.progress).toBe(0.75);
    });

    it('should mark media as completed', async () => {
      const movie = MediaFixtures.testMovie();
      const user = UserFixtures.testUser();
      const client = testDb.getClient();
      
      await client.user.create({
        data: { ...user, createdAt: new Date(), updatedAt: new Date() }
      });
      await client.media.create({
        data: { ...movie, addedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }
      });
      
      authMock.mockAuthenticatedRequest(user);

      const response = await testServer.request('POST', `/api/media/${movie.plexId}/complete`, {
        headers: authMock.createAuthHeaders(user)
      });

      expect(response.status).toBe(200);
      expect(response.body.data.userMedia.completed).toBe(true);
      expect(response.body.data.userMedia.progress).toBe(1.0);
    });
  });

  describe('Admin APIs', () => {
    it('should get all users (admin only)', async () => {
      const admin = UserFixtures.adminUser();
      const users = UserFixtures.createUsers(3);
      const client = testDb.getClient();
      
      await client.user.create({
        data: { ...admin, createdAt: new Date(), updatedAt: new Date() }
      });
      
      for (const user of users) {
        await client.user.create({
          data: { ...user, createdAt: new Date(), updatedAt: new Date() }
        });
      }
      
      authMock.mockAdminRequest(admin);

      const response = await testServer.request('GET', '/api/admin/users', {
        headers: authMock.createAuthHeaders(admin)
      });

      expect(response.status).toBe(200);
      expect(response.body.data.users.length).toBeGreaterThan(0);
    });

    it('should update user role (admin only)', async () => {
      const admin = UserFixtures.adminUser();
      const user = UserFixtures.testUser();
      const client = testDb.getClient();
      
      await client.user.create({
        data: { ...admin, createdAt: new Date(), updatedAt: new Date() }
      });
      await client.user.create({
        data: { ...user, createdAt: new Date(), updatedAt: new Date() }
      });
      
      authMock.mockAdminRequest(admin);

      const response = await testServer.request('PUT', `/api/admin/users/${user.id}/role`, {
        headers: authMock.createAuthHeaders(admin),
        body: { role: 'ADMIN' }
      });

      expect(response.status).toBe(200);
      expect(response.body.data.user.role).toBe('ADMIN');
    });

    it('should get system statistics (admin only)', async () => {
      const admin = UserFixtures.adminUser();
      authMock.mockAdminRequest(admin);

      const response = await testServer.request('GET', '/api/admin/stats', {
        headers: authMock.createAuthHeaders(admin)
      });

      expect(response.status).toBe(200);
      expect(response.body.data.stats).toEqual(
        expect.objectContaining({
          totalUsers: expect.any(Number),
          totalMedia: expect.any(Number),
          totalWatchTime: expect.any(Number)
        })
      );
    });

    it('should prevent non-admin access to admin endpoints', async () => {
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
  });

  describe('Plex Webhook APIs', () => {
    it('should handle play event webhook', async () => {
      const user = UserFixtures.testUser();
      const movie = MediaFixtures.testMovie();
      const client = testDb.getClient();
      
      await client.user.create({
        data: { ...user, createdAt: new Date(), updatedAt: new Date() }
      });
      await client.media.create({
        data: { ...movie, addedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }
      });

      const webhookPayload = {
        event: 'media.play',
        user: true,
        owner: true,
        Account: { id: 123, title: user.name },
        Server: { title: 'Test Server', uuid: 'test-uuid' },
        Player: { title: 'Test Player', uuid: 'player-uuid' },
        Metadata: {
          ratingKey: movie.plexId,
          type: movie.type,
          title: movie.title,
          duration: movie.duration
        }
      };

      const response = await testServer.request('POST', '/api/webhooks/plex', {
        body: webhookPayload,
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle stop event webhook with progress update', async () => {
      const user = UserFixtures.testUser();
      const movie = MediaFixtures.testMovie();
      const client = testDb.getClient();
      
      await client.user.create({
        data: { ...user, createdAt: new Date(), updatedAt: new Date() }
      });
      await client.media.create({
        data: { ...movie, addedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }
      });

      const webhookPayload = {
        event: 'media.stop',
        user: true,
        owner: true,
        Account: { id: 123, title: user.name },
        Server: { title: 'Test Server', uuid: 'test-uuid' },
        Player: { title: 'Test Player', uuid: 'player-uuid' },
        Metadata: {
          ratingKey: movie.plexId,
          type: movie.type,
          title: movie.title,
          duration: movie.duration,
          viewOffset: 3600000 // 1 hour
        }
      };

      const response = await testServer.request('POST', '/api/webhooks/plex', {
        body: webhookPayload,
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.status).toBe(200);
      
      // Check that progress was recorded
      const watchHistory = await client.watchHistory.findMany({
        where: { userId: user.id, mediaId: movie.plexId }
      });
      
      expect(watchHistory.length).toBeGreaterThan(0);
      expect(watchHistory[0].progress).toBeCloseTo(0.5, 1); // ~50% progress
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('should handle non-existent user requests', async () => {
      const fakeUser = { ...UserFixtures.testUser(), id: 'non-existent-user' };
      authMock.mockAuthenticatedRequest(fakeUser);

      const response = await testServer.request('GET', '/api/user/profile', {
        headers: authMock.createAuthHeaders(fakeUser)
      });

      expect(response.status).toBe(404);
      expect(response.body).toEqual(
        APIFixtures.errorResponse('User not found', 'USER_NOT_FOUND')
      );
    });

    it('should handle non-existent media requests', async () => {
      const user = UserFixtures.testUser();
      authMock.mockAuthenticatedRequest(user);

      const response = await testServer.request('GET', '/api/media/non-existent-media', {
        headers: authMock.createAuthHeaders(user)
      });

      expect(response.status).toBe(404);
      expect(response.body).toEqual(
        APIFixtures.errorResponse('Media not found', 'MEDIA_NOT_FOUND')
      );
    });

    it('should handle malformed request bodies', async () => {
      const user = UserFixtures.testUser();
      authMock.mockAuthenticatedRequest(user);

      const response = await testServer.request('PUT', '/api/user/profile', {
        headers: authMock.createAuthHeaders(user),
        body: { invalidField: 'invalid value', email: 'not-an-email' }
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(
        APIFixtures.errorResponse('Invalid request data', 'VALIDATION_ERROR')
      );
    });

    it('should handle database connection failures', async () => {
      const user = UserFixtures.testUser();
      const client = testDb.getClient();
      
      // Mock database error
      vi.spyOn(client.user, 'findUnique').mockRejectedValueOnce(
        new Error('Database connection failed')
      );
      
      authMock.mockAuthenticatedRequest(user);

      const response = await testServer.request('GET', '/api/user/profile', {
        headers: authMock.createAuthHeaders(user)
      });

      expect(response.status).toBe(500);
      expect(response.body).toEqual(
        APIFixtures.errorResponse('Internal server error', 'DATABASE_ERROR')
      );
    });

    it('should handle rate limiting', async () => {
      const user = UserFixtures.testUser();
      authMock.mockAuthenticatedRequest(user);
      
      // Make multiple rapid requests
      const requests = Array.from({ length: 100 }, (_, i) =>
        testServer.request('GET', `/api/media/search?q=test${i}`, {
          headers: authMock.createAuthHeaders(user)
        })
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Performance & Scalability', () => {
    it('should handle concurrent API requests efficiently', async () => {
      const users = UserFixtures.createUsers(10);
      const client = testDb.getClient();
      
      // Create users in database
      for (const user of users) {
        await client.user.create({
          data: { ...user, createdAt: new Date(), updatedAt: new Date() }
        });
      }

      const startTime = Date.now();
      
      const requests = users.map(user => {
        authMock.mockAuthenticatedRequest(user);
        return testServer.request('GET', '/api/user/profile', {
          headers: authMock.createAuthHeaders(user)
        });
      });

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should efficiently paginate large datasets', async () => {
      const movies = MediaFixtures.createMovies(100);
      const user = UserFixtures.testUser();
      const client = testDb.getClient();
      
      // Create test data
      await client.user.create({
        data: { ...user, createdAt: new Date(), updatedAt: new Date() }
      });
      
      for (const movie of movies) {
        await client.media.create({
          data: { ...movie, addedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }
        });
      }
      
      authMock.mockAuthenticatedRequest(user);

      const response = await testServer.request('GET', '/api/media', {
        headers: authMock.createAuthHeaders(user),
        query: { page: '1', limit: '20' }
      });

      expect(response.status).toBe(200);
      expect(response.body.data.items).toHaveLength(20);
      expect(response.body.data.pagination.total).toBe(100);
      expect(response.body.data.pagination.pages).toBe(5);
    });
  });
});