import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { TestServerSetup, TestDatabaseSetup, TestUtils } from '../helpers/test-setup';
import { UserFactory, MediaRequestFactory } from '../factories/test-data.factory';

describe('End-to-End User Workflows', () => {
  let app: Express;
  let baseUrl: string;
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    app = (await import('../../src/app')).default;
    baseUrl = (await TestServerSetup.startTestServer(app)) as string;
  });

  afterAll(async () => {
    await TestServerSetup.stopTestServer();
  });

  beforeEach(async () => {
    // Create fresh test user for each test
    testUser = UserFactory.create({
      email: 'workflow-test@example.com',
      password: 'SecurePassword123!',
    });
  });

  describe('Complete User Registration and Authentication Flow', () => {
    it('should complete full user registration workflow', async () => {
      // Step 1: Register new user
      const registrationResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testUser.email,
          password: testUser.password,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
        })
        .expect(201);

      expect(registrationResponse.body.user).toBeDefined();
      expect(registrationResponse.body.user.email).toBe(testUser.email);
      expect(registrationResponse.body.tokens).toBeDefined();

      // Step 2: Verify email (if email verification is enabled)
      if (registrationResponse.body.requiresVerification) {
        const verificationToken = 'mock-verification-token'; // In real app, this would come from email

        await request(app)
          .post('/api/v1/auth/verify-email')
          .send({ token: verificationToken })
          .expect(200);
      }

      // Step 3: Login with new credentials
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(loginResponse.body.tokens.accessToken).toBeDefined();
      expect(loginResponse.body.user.email).toBe(testUser.email);

      authToken = loginResponse.body.tokens.accessToken;

      // Step 4: Access protected resource
      const profileResponse = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(profileResponse.body.email).toBe(testUser.email);
      expect(profileResponse.body.firstName).toBe(testUser.firstName);
    });

    it('should handle password reset workflow', async () => {
      // First register a user
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testUser.email,
          password: testUser.password,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
        })
        .expect(201);

      // Step 1: Request password reset
      await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      // Step 2: Reset password with token (mock token)
      const resetToken = 'mock-reset-token';
      const newPassword = 'NewSecurePassword123!';

      await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: resetToken,
          password: newPassword,
        })
        .expect(200);

      // Step 3: Login with new password
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: newPassword,
        })
        .expect(200);

      expect(loginResponse.body.tokens.accessToken).toBeDefined();
    });

    it('should handle token refresh workflow', async () => {
      // Register and login first
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testUser.email,
          password: testUser.password,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
        })
        .expect(201);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      const { refreshToken } = loginResponse.body.tokens;

      // Refresh token
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body.accessToken).toBeDefined();
      expect(refreshResponse.body.refreshToken).toBeDefined();

      // Use new access token
      await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${refreshResponse.body.accessToken}`)
        .expect(200);
    });
  });

  describe('Media Request Workflow', () => {
    beforeEach(async () => {
      // Setup authenticated user
      const registrationResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testUser.email,
          password: testUser.password,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
        })
        .expect(201);

      authToken = registrationResponse.body.tokens.accessToken;
    });

    it('should complete full media request workflow', async () => {
      const mediaRequest = MediaRequestFactory.create({
        title: 'Test Movie Request',
        description: 'A movie for testing',
        mediaType: 'movie',
      });

      // Step 1: Create media request
      const createResponse = await request(app)
        .post('/api/v1/media/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: mediaRequest.title,
          description: mediaRequest.description,
          mediaType: mediaRequest.mediaType,
          priority: 'medium',
        })
        .expect(201);

      const requestId = createResponse.body.id;
      expect(createResponse.body.status).toBe('pending');

      // Step 2: View request in user's list
      const userRequestsResponse = await request(app)
        .get('/api/v1/media/my-requests')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(userRequestsResponse.body.requests).toHaveLength(1);
      expect(userRequestsResponse.body.requests[0].id).toBe(requestId);

      // Step 3: Admin approves request (simulate admin user)
      const adminUser = UserFactory.createAdmin();
      const adminRegistration = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: adminUser.email,
          password: 'AdminPassword123!',
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          isAdmin: true,
        })
        .expect(201);

      const adminToken = adminRegistration.body.tokens.accessToken;

      await request(app)
        .put(`/api/v1/admin/media-requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Approved for download' })
        .expect(200);

      // Step 4: Check request status
      const statusResponse = await request(app)
        .get(`/api/v1/media/request/${requestId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statusResponse.body.status).toBe('approved');

      // Step 5: Mark as completed
      await request(app)
        .put(`/api/v1/admin/media-requests/${requestId}/complete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Step 6: Verify completion
      const completedResponse = await request(app)
        .get(`/api/v1/media/request/${requestId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(completedResponse.body.status).toBe('completed');
    });

    it('should handle request modification workflow', async () => {
      // Create initial request
      const createResponse = await request(app)
        .post('/api/v1/media/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Original Title',
          description: 'Original description',
          mediaType: 'movie',
        })
        .expect(201);

      const requestId = createResponse.body.id;

      // Update request
      await request(app)
        .put(`/api/v1/media/request/${requestId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Title',
          description: 'Updated description',
          priority: 'high',
        })
        .expect(200);

      // Verify update
      const updatedResponse = await request(app)
        .get(`/api/v1/media/request/${requestId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(updatedResponse.body.title).toBe('Updated Title');
      expect(updatedResponse.body.priority).toBe('high');

      // Cancel request
      await request(app)
        .delete(`/api/v1/media/request/${requestId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify cancellation
      await request(app)
        .get(`/api/v1/media/request/${requestId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('YouTube Download Workflow', () => {
    beforeEach(async () => {
      // Setup authenticated user
      const registrationResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testUser.email,
          password: testUser.password,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
        })
        .expect(201);

      authToken = registrationResponse.body.tokens.accessToken;
    });

    it('should complete YouTube download workflow', async () => {
      const youtubeUrl = 'https://youtube.com/watch?v=dQw4w9WgXcQ';

      // Step 1: Start download
      const downloadResponse = await request(app)
        .post('/api/v1/youtube/download')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: youtubeUrl,
          quality: '720p',
          format: 'mp4',
        })
        .expect(202); // Accepted for processing

      const downloadId = downloadResponse.body.id;
      expect(downloadResponse.body.status).toBe('pending');

      // Step 2: Check download progress
      await TestUtils.waitFor(
        async () => {
          const progressResponse = await request(app)
            .get(`/api/v1/youtube/download/${downloadId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          return progressResponse.body.status !== 'pending';
        },
        10000,
        1000,
      );

      // Step 3: Monitor until completion or failure
      let finalStatus;
      await TestUtils.waitFor(
        async () => {
          const statusResponse = await request(app)
            .get(`/api/v1/youtube/download/${downloadId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          finalStatus = statusResponse.body.status;
          return finalStatus === 'completed' || finalStatus === 'failed';
        },
        30000,
        2000,
      );

      // Step 4: Handle completion
      if (finalStatus === 'completed') {
        const completedResponse = await request(app)
          .get(`/api/v1/youtube/download/${downloadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(completedResponse.body.downloadPath).toBeDefined();
        expect(completedResponse.body.progress).toBe(100);

        // Optional: Download the file
        const fileResponse = await request(app)
          .get(`/api/v1/youtube/download/${downloadId}/file`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(fileResponse.headers['content-type']).toContain('video');
      } else {
        // Handle failure case
        const failedResponse = await request(app)
          .get(`/api/v1/youtube/download/${downloadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(failedResponse.body.error).toBeDefined();
      }

      // Step 5: View download history
      const historyResponse = await request(app)
        .get('/api/v1/youtube/downloads')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(historyResponse.body.downloads).toHaveLength(1);
      expect(historyResponse.body.downloads[0].id).toBe(downloadId);
    });

    it('should handle download cancellation workflow', async () => {
      const youtubeUrl = 'https://youtube.com/watch?v=test-cancellation';

      // Start download
      const downloadResponse = await request(app)
        .post('/api/v1/youtube/download')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: youtubeUrl,
          quality: '1080p',
          format: 'mp4',
        })
        .expect(202);

      const downloadId = downloadResponse.body.id;

      // Cancel download
      await request(app)
        .delete(`/api/v1/youtube/download/${downloadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify cancellation
      const cancelledResponse = await request(app)
        .get(`/api/v1/youtube/download/${downloadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(cancelledResponse.body.status).toBe('cancelled');
    });
  });

  describe('Plex Integration Workflow', () => {
    beforeEach(async () => {
      // Setup authenticated user
      const registrationResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testUser.email,
          password: testUser.password,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
        })
        .expect(201);

      authToken = registrationResponse.body.tokens.accessToken;
    });

    it('should complete Plex authentication and library browsing workflow', async () => {
      // Step 1: Connect to Plex
      const plexAuthResponse = await request(app)
        .post('/api/v1/plex/authenticate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          plexUsername: 'testplexuser',
          plexPassword: 'plexpassword',
        })
        .expect(200);

      expect(plexAuthResponse.body.connected).toBe(true);

      // Step 2: Get Plex libraries
      const librariesResponse = await request(app)
        .get('/api/v1/plex/libraries')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(librariesResponse.body.libraries).toBeDefined();
      expect(Array.isArray(librariesResponse.body.libraries)).toBe(true);

      // Step 3: Browse library contents
      if (librariesResponse.body.libraries.length > 0) {
        const libraryKey = librariesResponse.body.libraries[0].key;

        const contentsResponse = await request(app)
          .get(`/api/v1/plex/library/${libraryKey}`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ page: 1, limit: 20 })
          .expect(200);

        expect(contentsResponse.body.contents).toBeDefined();
      }

      // Step 4: Search Plex media
      const searchResponse = await request(app)
        .get('/api/v1/plex/search')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ q: 'test', type: 'movie' })
        .expect(200);

      expect(searchResponse.body.results).toBeDefined();

      // Step 5: Get recently added
      const recentResponse = await request(app)
        .get('/api/v1/plex/recent')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10 })
        .expect(200);

      expect(recentResponse.body.items).toBeDefined();
    });

    it('should handle Plex connection errors gracefully', async () => {
      // Attempt connection with invalid credentials
      const invalidAuthResponse = await request(app)
        .post('/api/v1/plex/authenticate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          plexUsername: 'invaliduser',
          plexPassword: 'wrongpassword',
        })
        .expect(401);

      expect(invalidAuthResponse.body.error).toContain('authentication');

      // Attempt to access Plex endpoints without connection
      await request(app)
        .get('/api/v1/plex/libraries')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403); // Should require Plex authentication

      // Attempt connection with unreachable server
      await request(app)
        .post('/api/v1/plex/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ serverUrl: 'http://unreachable-server:32400' })
        .expect(503); // Service unavailable
    });
  });

  describe('Error Handling and Recovery Workflows', () => {
    beforeEach(async () => {
      const registrationResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testUser.email,
          password: testUser.password,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
        })
        .expect(201);

      authToken = registrationResponse.body.tokens.accessToken;
    });

    it('should handle rate limiting gracefully', async () => {
      // Rapidly make requests to trigger rate limiting
      const requests = Array.from({ length: 50 }, () =>
        request(app).get('/api/v1/media/popular').set('Authorization', `Bearer ${authToken}`),
      );

      const responses = await Promise.allSettled(requests);

      // Some requests should be rate limited
      const rateLimited = responses.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 429,
      );

      expect(rateLimited.length).toBeGreaterThan(0);

      // Wait for rate limit to reset
      await new Promise((resolve) => setTimeout(resolve, 61000));

      // Should be able to make requests again
      await request(app)
        .get('/api/v1/media/popular')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('should handle network interruptions and retry logic', async () => {
      // This test would require network manipulation capabilities
      // For now, we'll test timeout scenarios

      const timeoutRequest = request(app)
        .get('/api/v1/plex/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .timeout(100); // Very short timeout

      await expect(timeoutRequest).rejects.toThrow();

      // Normal request should still work
      await request(app).get('/api/v1/health').expect(200);
    });

    it('should maintain session state across temporary failures', async () => {
      // Make successful request
      const successResponse = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(successResponse.body.email).toBe(testUser.email);

      // Simulate temporary server issues (this would require server manipulation)
      // For now, test with invalid endpoints
      await request(app)
        .get('/api/v1/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      // Session should still be valid
      const stillValidResponse = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(stillValidResponse.body.email).toBe(testUser.email);
    });
  });

  describe('Data Consistency Workflows', () => {
    beforeEach(async () => {
      const registrationResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testUser.email,
          password: testUser.password,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
        })
        .expect(201);

      authToken = registrationResponse.body.tokens.accessToken;
    });

    it('should maintain data consistency across concurrent operations', async () => {
      const mediaRequests = Array.from({ length: 5 }, (_, i) => ({
        title: `Concurrent Movie ${i}`,
        description: `Test movie ${i}`,
        mediaType: 'movie',
        priority: 'medium',
      }));

      // Create multiple requests concurrently
      const createPromises = mediaRequests.map((request) =>
        request(app)
          .post('/api/v1/media/request')
          .set('Authorization', `Bearer ${authToken}`)
          .send(request),
      );

      const responses = await Promise.all(createPromises);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body.id).toBeDefined();
      });

      // Verify all requests exist
      const listResponse = await request(app)
        .get('/api/v1/media/my-requests')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listResponse.body.requests).toHaveLength(5);

      // Each request should have unique ID
      const ids = listResponse.body.requests.map((r: any) => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5);
    });

    it('should handle transaction rollbacks correctly', async () => {
      // Attempt to create request with invalid data that should rollback
      await request(app)
        .post('/api/v1/media/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '', // Invalid: empty title
          mediaType: 'invalid-type', // Invalid media type
          description: 'This should fail',
        })
        .expect(400);

      // Verify no partial data was saved
      const listResponse = await request(app)
        .get('/api/v1/media/my-requests')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listResponse.body.requests).toHaveLength(0);

      // Valid request should still work
      await request(app)
        .post('/api/v1/media/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Valid Movie',
          mediaType: 'movie',
          description: 'This should succeed',
        })
        .expect(201);
    });
  });
});
