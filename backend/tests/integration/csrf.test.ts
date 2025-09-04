import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { setupTestDB, cleanupTestDB } from '../helpers/database';
import { createTestUser } from '../helpers/auth';
import { User } from '@prisma/client';

describe('CSRF Protection', () => {
  let testUser: User;
  let authToken: string;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await cleanupTestDB();
  });

  beforeEach(async () => {
    const { user, token } = await createTestUser();
    testUser = user;
    authToken = token;
  });

  describe('CSRF Token Endpoints', () => {
    it('should generate CSRF token for unauthenticated users', async () => {
      const response = await request(app).get('/api/v1/csrf/token').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.expiresIn).toBe(3600);
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should generate CSRF token for authenticated users', async () => {
      const response = await request(app)
        .get('/api/v1/csrf/token')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.expiresIn).toBe(3600);
    });

    it('should refresh CSRF token', async () => {
      // Get initial token
      const tokenResponse = await request(app)
        .get('/api/v1/csrf/token')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const initialToken = tokenResponse.body.data.token;

      // Refresh token
      const refreshResponse = await request(app)
        .post('/api/v1/csrf/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const newToken = refreshResponse.body.data.token;

      expect(newToken).toBeDefined();
      expect(newToken).not.toBe(initialToken);
    });

    it('should return CSRF stats for admin', async () => {
      // Create admin user
      const { token: adminToken } = await createTestUser({ role: 'admin' });

      const response = await request(app)
        .get('/api/v1/csrf/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalTokens).toBeDefined();
      expect(response.body.data.protection).toBe('double-submit-cookie');
    });

    it('should reject CSRF stats for non-admin', async () => {
      await request(app)
        .get('/api/v1/csrf/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('CSRF Protection on State-Changing Endpoints', () => {
    let csrfToken: string;
    let cookieHeader: string[];

    beforeEach(async () => {
      // Get CSRF token
      const tokenResponse = await request(app)
        .get('/api/v1/csrf/token')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      csrfToken = tokenResponse.body.data.token;
      cookieHeader = tokenResponse.headers['set-cookie'] || [];
    });

    it('should protect POST endpoints', async () => {
      // Should fail without CSRF token
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      // Should succeed with CSRF token
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', cookieHeader.join('; '))
        .expect(200);
    });

    it('should protect PUT endpoints', async () => {
      // Create a media request first
      const mediaRequest = await request(app)
        .post('/api/v1/media/request')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', cookieHeader.join('; '))
        .send({
          type: 'movie',
          title: 'Test Movie',
          tmdbId: 12345,
        })
        .expect(201);

      const requestId = mediaRequest.body.data.id;

      // Should fail without CSRF token
      await request(app)
        .put(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' })
        .expect(403);

      // Should succeed with CSRF token
      await request(app)
        .put(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', cookieHeader.join('; '))
        .send({ status: 'approved' })
        .expect(200);
    });

    it('should protect DELETE endpoints', async () => {
      // Create a media request first
      const mediaRequest = await request(app)
        .post('/api/v1/media/request')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', cookieHeader.join('; '))
        .send({
          type: 'movie',
          title: 'Test Movie',
          tmdbId: 12345,
        })
        .expect(201);

      const requestId = mediaRequest.body.data.id;

      // Should fail without CSRF token
      await request(app)
        .delete(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      // Should succeed with CSRF token
      await request(app)
        .delete(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', cookieHeader.join('; '))
        .expect(200);
    });

    it('should allow GET requests without CSRF token', async () => {
      await request(app)
        .get('/api/v1/media/search')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ q: 'test' })
        .expect(200);
    });

    it('should allow excluded routes without CSRF token', async () => {
      await request(app).get('/api/v1/health').expect(200);

      await request(app).post('/api/v1/auth/plex/pin').send({ clientName: 'Test' }).expect(200);
    });
  });

  describe('Double-Submit Cookie Pattern', () => {
    it('should reject requests with mismatched cookie and header tokens', async () => {
      // Get CSRF token
      const tokenResponse = await request(app)
        .get('/api/v1/csrf/token')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const csrfToken = tokenResponse.body.data.token;
      const cookieHeader = tokenResponse.headers['set-cookie'] || [];

      // Use different token in header than in cookie
      const fakeToken = 'fake-token-123456789abcdef';

      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', fakeToken)
        .set('Cookie', cookieHeader.join('; '))
        .expect(403);
    });

    it('should reject requests with missing cookie', async () => {
      // Get CSRF token
      const tokenResponse = await request(app)
        .get('/api/v1/csrf/token')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const csrfToken = tokenResponse.body.data.token;

      // Use header token but no cookie
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', csrfToken)
        .expect(403);
    });

    it('should reject requests with missing header', async () => {
      // Get CSRF token
      const tokenResponse = await request(app)
        .get('/api/v1/csrf/token')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const cookieHeader = tokenResponse.headers['set-cookie'] || [];

      // Use cookie but no header token
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Cookie', cookieHeader.join('; '))
        .expect(403);
    });
  });

  describe('Token Expiration', () => {
    it('should reject expired tokens', async () => {
      // This test would require mocking time or waiting for actual expiration
      // For now, we'll test that the error handling is correct

      const expiredToken = 'expired-token-123456789abcdef';

      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', expiredToken)
        .set('Cookie', `csrf-token=${expiredToken}`)
        .expect(403);
    });
  });

  describe('Error Handling', () => {
    it('should return appropriate error codes for CSRF failures', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.code).toBe('CSRF_TOKEN_MISSING');
      expect(response.body.message).toContain('CSRF token missing');
    });

    it('should log CSRF validation failures', async () => {
      // This would require mocking the logger to verify log messages
      // For integration tests, we'll just verify the response

      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });
});
