import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { User, MediaRequest } from '@prisma/client';

import { app } from '../../../src/server';
import { cleanDatabase, disconnectDatabase } from '../../helpers/database';
import { createTestUser, generateValidToken } from '../../helpers/auth';
import { UserRepository } from '../../../src/repositories/user.repository';
import { MediaRequestRepository } from '../../../src/repositories/media-request.repository';
import { SessionTokenRepository } from '../../../src/repositories/session-token.repository';

describe('User Data Isolation Security Tests', () => {
  let userRepository: UserRepository;
  let mediaRequestRepository: MediaRequestRepository;
  let sessionTokenRepository: SessionTokenRepository;
  
  // Test users
  let user1: User;
  let user2: User;
  let adminUser: User;
  
  // Test tokens
  let user1Token: string;
  let user2Token: string;
  let adminToken: string;
  
  // Test data
  let user1MediaRequest: MediaRequest;
  let user2MediaRequest: MediaRequest;

  beforeAll(async () => {
    userRepository = new UserRepository();
    mediaRequestRepository = new MediaRequestRepository();
    sessionTokenRepository = new SessionTokenRepository();
  });

  beforeEach(async () => {
    await cleanDatabase();

    // Create test users
    user1 = await createTestUser({
      email: 'user1@test.com',
      name: 'User One',
      plexId: 'plex-user-1',
      role: 'user',
    });

    user2 = await createTestUser({
      email: 'user2@test.com', 
      name: 'User Two',
      plexId: 'plex-user-2',
      role: 'user',
    });

    adminUser = await createTestUser({
      email: 'admin@test.com',
      name: 'Admin User',
      plexId: 'plex-admin',
      role: 'admin',
    });

    // Generate tokens for all users
    user1Token = await generateValidToken(user1.id);
    user2Token = await generateValidToken(user2.id);
    adminToken = await generateValidToken(adminUser.id);

    // Create test media requests for each user
    user1MediaRequest = await mediaRequestRepository.create({
      userId: user1.id,
      title: 'User 1 Movie Request',
      mediaType: 'movie',
      tmdbId: '12345',
    });

    user2MediaRequest = await mediaRequestRepository.create({
      userId: user2.id,
      title: 'User 2 Movie Request',
      mediaType: 'movie', 
      tmdbId: '67890',
    });
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('Media Request Data Isolation', () => {
    it('should prevent user1 from accessing user2 media requests', async () => {
      const response = await request(app)
        .get(`/api/media-requests/${user2MediaRequest.id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(404);
    });

    it('should prevent user2 from accessing user1 media requests', async () => {
      const response = await request(app)
        .get(`/api/media-requests/${user1MediaRequest.id}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(404);
    });

    it('should allow user1 to access their own media requests', async () => {
      const response = await request(app)
        .get(`/api/media-requests/${user1MediaRequest.id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(user1MediaRequest.id);
      expect(response.body.userId).toBe(user1.id);
    });

    it('should allow user2 to access their own media requests', async () => {
      const response = await request(app)
        .get(`/api/media-requests/${user2MediaRequest.id}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(user2MediaRequest.id);
      expect(response.body.userId).toBe(user2.id);
    });

    it('should prevent user1 from updating user2 media requests', async () => {
      const response = await request(app)
        .patch(`/api/media-requests/${user2MediaRequest.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ status: 'approved' });

      expect(response.status).toBe(404);
    });

    it('should prevent user1 from deleting user2 media requests', async () => {
      const response = await request(app)
        .delete(`/api/media-requests/${user2MediaRequest.id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(404);
    });

    it('should only return user-specific media requests in list endpoint', async () => {
      const user1Response = await request(app)
        .get('/api/media-requests')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(user1Response.status).toBe(200);
      expect(user1Response.body.data).toHaveLength(1);
      expect(user1Response.body.data[0].userId).toBe(user1.id);

      const user2Response = await request(app)
        .get('/api/media-requests')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(user2Response.status).toBe(200);
      expect(user2Response.body.data).toHaveLength(1);
      expect(user2Response.body.data[0].userId).toBe(user2.id);
    });
  });

  describe('User Profile Data Isolation', () => {
    it('should prevent user1 from accessing user2 profile', async () => {
      const response = await request(app)
        .get(`/api/users/${user2.id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(403);
    });

    it('should prevent user2 from accessing user1 profile', async () => {
      const response = await request(app)
        .get(`/api/users/${user1.id}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(403);
    });

    it('should allow user1 to access their own profile', async () => {
      const response = await request(app)
        .get(`/api/users/${user1.id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(user1.id);
      expect(response.body.email).toBe(user1.email);
    });

    it('should prevent user1 from updating user2 profile', async () => {
      const response = await request(app)
        .patch(`/api/users/${user2.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Hacked Name' });

      expect(response.status).toBe(403);
    });

    it('should prevent exposing sensitive user data in error messages', async () => {
      const response = await request(app)
        .get(`/api/users/${user2.id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(403);
      expect(response.body.message).not.toContain(user2.email);
      expect(response.body.message).not.toContain(user2.plexId);
      expect(response.body.message).not.toContain(user2.name);
    });
  });

  describe('Cross-User Session Isolation', () => {
    it('should prevent session token reuse between users', async () => {
      // Try to use user1's token to access user2's data
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(user1.id);
      expect(response.body.id).not.toBe(user2.id);
    });

    it('should invalidate sessions when user is deactivated', async () => {
      // Deactivate user1
      await userRepository.update(user1.id, { status: 'inactive' });

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(401);
    });

    it('should prevent cross-user token validation', async () => {
      // Create a malicious token with user2's ID but signed with user1's data
      const maliciousToken = await generateValidToken(user2.id);
      
      // Try to access user1's data with the malicious token
      const response = await request(app)
        .get(`/api/users/${user1.id}`)
        .set('Authorization', `Bearer ${maliciousToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('Administrative Access Controls', () => {
    it('should allow admin to access all user media requests', async () => {
      const response = await request(app)
        .get(`/api/admin/media-requests/${user1MediaRequest.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(user1MediaRequest.id);
    });

    it('should allow admin to access user profiles', async () => {
      const response = await request(app)
        .get(`/api/admin/users/${user1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(user1.id);
    });

    it('should prevent regular users from accessing admin endpoints', async () => {
      const response = await request(app)
        .get(`/api/admin/users/${user2.id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(403);
    });

    it('should prevent regular users from accessing admin-only user list', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(403);
    });
  });

  describe('Database Query Injection Prevention', () => {
    it('should prevent SQL injection in user ID parameters', async () => {
      const maliciousId = "1' OR '1'='1' --";
      
      const response = await request(app)
        .get(`/api/users/${maliciousId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(400); // Should be caught by validation
    });

    it('should prevent SQL injection in media request search', async () => {
      const maliciousQuery = "title'; DROP TABLE users; --";
      
      const response = await request(app)
        .get('/api/media-requests')
        .query({ search: maliciousQuery })
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      // Should still work but safely handle the malicious input
    });

    it('should prevent NoSQL injection in filters', async () => {
      const maliciousFilter = { $ne: null };
      
      const response = await request(app)
        .get('/api/media-requests')
        .query({ status: JSON.stringify(maliciousFilter) })
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      // Should treat as string, not object injection
    });
  });

  describe('Data Leakage Prevention', () => {
    it('should not leak other users data in pagination metadata', async () => {
      // Create additional requests for user2
      for (let i = 0; i < 5; i++) {
        await mediaRequestRepository.create({
          userId: user2.id,
          title: `User 2 Request ${i}`,
          mediaType: 'tv',
        });
      }

      const response = await request(app)
        .get('/api/media-requests?limit=2')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1); // Only user1's request
      expect(response.body.pagination.total).toBe(1); // Only count user1's requests
      expect(response.body.pagination.totalPages).toBe(1);
    });

    it('should not leak user information in error responses', async () => {
      const response = await request(app)
        .get('/api/media-requests/nonexistent-id')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(404);
      expect(response.body.message).not.toContain('user');
      expect(response.body.message).not.toContain(user1.email);
      expect(response.body.message).not.toContain(user2.email);
    });

    it('should not expose internal IDs in API responses', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('plexToken');
      expect(response.body).not.toHaveProperty('internalId');
    });
  });

  describe('Concurrent Access Security', () => {
    it('should handle concurrent requests from different users safely', async () => {
      const promises = [
        request(app)
          .get('/api/media-requests')
          .set('Authorization', `Bearer ${user1Token}`),
        request(app)
          .get('/api/media-requests')
          .set('Authorization', `Bearer ${user2Token}`),
        request(app)
          .post('/api/media-requests')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({
            title: 'Concurrent Request 1',
            mediaType: 'movie',
            tmdbId: '11111',
          }),
        request(app)
          .post('/api/media-requests')
          .set('Authorization', `Bearer ${user2Token}`)
          .send({
            title: 'Concurrent Request 2',
            mediaType: 'movie',
            tmdbId: '22222',
          }),
      ];

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBeLessThan(400);
      });

      // Verify data isolation
      expect(responses[0].body.data[0].userId).toBe(user1.id);
      expect(responses[1].body.data[0].userId).toBe(user2.id);
      expect(responses[2].body.userId).toBe(user1.id);
      expect(responses[3].body.userId).toBe(user2.id);
    });

    it('should prevent race conditions in user data updates', async () => {
      const updatePromises = [
        request(app)
          .patch(`/api/users/${user1.id}`)
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ name: 'Update 1' }),
        request(app)
          .patch(`/api/users/${user1.id}`)
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ name: 'Update 2' }),
      ];

      const responses = await Promise.all(updatePromises);

      // Both requests should succeed or handle conflict appropriately
      expect(responses.every(r => r.status < 500)).toBe(true);
      
      // Verify final state is consistent
      const finalState = await request(app)
        .get(`/api/users/${user1.id}`)
        .set('Authorization', `Bearer ${user1Token}`);
        
      expect(finalState.status).toBe(200);
      expect(['Update 1', 'Update 2']).toContain(finalState.body.name);
    });
  });
});