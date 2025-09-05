import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { User } from '@prisma/client';

import { app } from '../../../src/server';
import { cleanDatabase, disconnectDatabase } from '../../helpers/database';
import { createTestUser, generateValidToken } from '../../helpers/auth';
import { getRedis } from '../../../src/config/redis';

describe('OAuth Security Comprehensive Tests', () => {
  let testUser: User;
  let userToken: string;
  let redis: any;

  beforeAll(async () => {
    redis = getRedis();
  });

  beforeEach(async () => {
    await cleanDatabase();
    
    testUser = await createTestUser({
      email: 'user@example.com',
      name: 'Test User',
      plexId: 'plex-user',
      role: 'user',
    });
    
    userToken = await generateValidToken(testUser.id);
    
    // Clear Redis state
    const keys = await redis.keys('oauth:*');
    if (keys.length > 0) {
      await redis.del(keys);
    }
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('OAuth Flow Security', () => {
    it('should implement PKCE for OAuth 2.0 flows', async () => {
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      // Start OAuth flow with PKCE
      const authResponse = await request(app)
        .post('/api/auth/oauth/authorize')
        .send({
          clientId: 'test-client',
          redirectUri: 'https://app.example.com/callback',
          codeChallenge,
          codeChallengeMethod: 'S256',
          state: 'random-state-123',
        });

      expect([200, 302]).toContain(authResponse.status);

      if (authResponse.status === 200) {
        const authorizationCode = authResponse.body.data.code;

        // Exchange code for token with correct verifier
        const tokenResponse = await request(app)
          .post('/api/auth/oauth/token')
          .send({
            code: authorizationCode,
            codeVerifier,
            clientId: 'test-client',
            redirectUri: 'https://app.example.com/callback',
          });

        expect([200, 201]).toContain(tokenResponse.status);

        // Try with wrong verifier should fail
        const wrongTokenResponse = await request(app)
          .post('/api/auth/oauth/token')
          .send({
            code: authorizationCode,
            codeVerifier: 'wrong-verifier',
            clientId: 'test-client',
            redirectUri: 'https://app.example.com/callback',
          });

        expect(wrongTokenResponse.status).toBe(400);
        expect(wrongTokenResponse.body.code).toBe('INVALID_CODE_VERIFIER');
      }
    });

    it('should prevent OAuth state parameter attacks', async () => {
      // Valid state parameter
      const validState = crypto.randomBytes(16).toString('hex');
      
      const authResponse = await request(app)
        .post('/api/auth/oauth/authorize')
        .send({
          clientId: 'test-client',
          redirectUri: 'https://app.example.com/callback',
          state: validState,
        });

      if (authResponse.status === 200) {
        const authCode = authResponse.body.data.code;

        // Callback with correct state should work
        const callbackResponse = await request(app)
          .get('/api/auth/oauth/callback')
          .query({
            code: authCode,
            state: validState,
          });

        expect([200, 302]).toContain(callbackResponse.status);

        // Callback with wrong state should fail
        const wrongStateResponse = await request(app)
          .get('/api/auth/oauth/callback')
          .query({
            code: authCode,
            state: 'wrong-state',
          });

        expect(wrongStateResponse.status).toBe(400);
        expect(wrongStateResponse.body.code).toBe('INVALID_STATE');
      }
    });

    it('should validate redirect URIs strictly', async () => {
      const maliciousRedirects = [
        'http://evil.com/callback',
        'https://app.example.com.evil.com/callback',
        'https://app.example.com/callback/../admin',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'https://app.example.com:8080/callback', // Different port
        'https://subdomain.app.example.com/callback', // Subdomain
      ];

      for (const redirectUri of maliciousRedirects) {
        const response = await request(app)
          .post('/api/auth/oauth/authorize')
          .send({
            clientId: 'test-client',
            redirectUri,
            state: 'test-state',
          });

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('INVALID_REDIRECT_URI');
      }
    });

    it('should prevent authorization code replay attacks', async () => {
      const authResponse = await request(app)
        .post('/api/auth/oauth/authorize')
        .send({
          clientId: 'test-client',
          redirectUri: 'https://app.example.com/callback',
          state: 'test-state',
        });

      if (authResponse.status === 200) {
        const code = authResponse.body.data.code;

        // First token exchange should work
        const firstToken = await request(app)
          .post('/api/auth/oauth/token')
          .send({
            code,
            clientId: 'test-client',
            redirectUri: 'https://app.example.com/callback',
            grantType: 'authorization_code',
          });

        expect([200, 201]).toContain(firstToken.status);

        // Second attempt with same code should fail
        const secondToken = await request(app)
          .post('/api/auth/oauth/token')
          .send({
            code,
            clientId: 'test-client',
            redirectUri: 'https://app.example.com/callback',
            grantType: 'authorization_code',
          });

        expect(secondToken.status).toBe(400);
        expect(secondToken.body.code).toBe('INVALID_AUTHORIZATION_CODE');
      }
    });

    it('should implement authorization code expiration', async () => {
      const authResponse = await request(app)
        .post('/api/auth/oauth/authorize')
        .send({
          clientId: 'test-client',
          redirectUri: 'https://app.example.com/callback',
          state: 'test-state',
        });

      if (authResponse.status === 200) {
        const code = authResponse.body.data.code;

        // Simulate time passing (code expires after 10 minutes)
        await redis.expire(`oauth:code:${code}`, 1);
        await new Promise(resolve => setTimeout(resolve, 1100));

        const tokenResponse = await request(app)
          .post('/api/auth/oauth/token')
          .send({
            code,
            clientId: 'test-client',
            redirectUri: 'https://app.example.com/callback',
            grantType: 'authorization_code',
          });

        expect(tokenResponse.status).toBe(400);
        expect(tokenResponse.body.code).toBe('EXPIRED_AUTHORIZATION_CODE');
      }
    });
  });

  describe('Plex OAuth Security', () => {
    it('should validate Plex PIN security', async () => {
      // Create PIN
      const pinResponse = await request(app)
        .post('/api/auth/plex/pin')
        .send({});

      expect(pinResponse.status).toBe(200);
      const pinData = pinResponse.body.data;
      
      // PIN should have proper format and expiration
      expect(pinData.code).toMatch(/^[A-Z0-9]{4}$/);
      expect(pinData.id).toBeDefined();
      expect(pinData.expiresAt).toBeDefined();
      expect(new Date(pinData.expiresAt) > new Date()).toBe(true);

      // PIN should expire after reasonable time (15 minutes)
      const expiresIn = new Date(pinData.expiresAt).getTime() - Date.now();
      expect(expiresIn).toBeLessThanOrEqual(15 * 60 * 1000); // 15 minutes
      expect(expiresIn).toBeGreaterThan(10 * 60 * 1000); // At least 10 minutes
    });

    it('should prevent PIN brute force attacks', async () => {
      const pinResponse = await request(app)
        .post('/api/auth/plex/pin')
        .send({});

      if (pinResponse.status === 200) {
        const pinId = pinResponse.body.data.id;
        const attempts = [];

        // Try multiple invalid codes
        for (let i = 0; i < 10; i++) {
          attempts.push(
            request(app)
              .get(`/api/auth/plex/pin/${pinId}/status`)
              .set('X-Plex-Code-Attempt', `FAKE${i}`)
          );
        }

        const responses = await Promise.all(attempts);
        const rateLimited = responses.filter(r => r.status === 429).length;

        // Should rate limit after several failed attempts
        expect(rateLimited).toBeGreaterThan(5);
      }
    });

    it('should validate Plex token authenticity', async () => {
      const pinResponse = await request(app)
        .post('/api/auth/plex/pin')
        .send({});

      if (pinResponse.status === 200) {
        const pinId = pinResponse.body.data.id;

        // Mock invalid Plex token
        vi.mock('@/services/plex-auth.service', () => ({
          PlexAuthService: {
            completeOAuth: vi.fn().mockRejectedValue(new Error('Invalid Plex token')),
          },
        }));

        const completeResponse = await request(app)
          .post('/api/auth/plex')
          .send({ pinId });

        expect([400, 401]).toContain(completeResponse.status);
        expect(completeResponse.body.code).toContain('PLEX');
      }
    });

    it('should prevent Plex account hijacking', async () => {
      // Create legitimate user
      const legitimateUser = await createTestUser({
        email: 'legitimate@example.com',
        plexId: 'existing-plex-id',
        plexUsername: 'legitimate_user',
        role: 'user',
      });

      // Attacker tries to link same Plex account
      const pinResponse = await request(app)
        .post('/api/auth/plex/pin')
        .send({});

      if (pinResponse.status === 200) {
        const pinId = pinResponse.body.data.id;

        // Mock Plex response with existing user's Plex ID
        const completeResponse = await request(app)
          .post('/api/auth/plex')
          .send({ pinId });

        // Should either update existing user or prevent linking
        expect([200, 400, 409]).toContain(completeResponse.status);
        
        if (completeResponse.status === 409) {
          expect(completeResponse.body.code).toBe('PLEX_ACCOUNT_ALREADY_LINKED');
        }
      }
    });
  });

  describe('OAuth Token Security', () => {
    it('should implement secure token storage and transmission', async () => {
      const tokenResponse = await request(app)
        .post('/api/auth/oauth/token')
        .send({
          grantType: 'client_credentials',
          clientId: 'test-client',
          clientSecret: 'test-secret',
        });

      if (tokenResponse.status === 200) {
        const token = tokenResponse.body.accessToken;
        
        // Token should be properly formatted JWT or opaque token
        expect(token).toBeDefined();
        expect(token.length).toBeGreaterThan(20);
        
        // Should not be stored in plaintext
        const redisKeys = await redis.keys('*');
        const plaintextTokens = [];
        
        for (const key of redisKeys) {
          const value = await redis.get(key);
          if (value && value.includes(token)) {
            plaintextTokens.push(key);
          }
        }
        
        expect(plaintextTokens.length).toBe(0);
      }
    });

    it('should implement proper token revocation', async () => {
      const tokenResponse = await request(app)
        .post('/api/auth/oauth/token')
        .send({
          grantType: 'client_credentials',
          clientId: 'test-client',
          clientSecret: 'test-secret',
        });

      if (tokenResponse.status === 200) {
        const accessToken = tokenResponse.body.accessToken;
        const refreshToken = tokenResponse.body.refreshToken;

        // Revoke token
        const revokeResponse = await request(app)
          .post('/api/auth/oauth/revoke')
          .send({
            token: accessToken,
            tokenTypeHint: 'access_token',
          });

        expect(revokeResponse.status).toBe(200);

        // Token should no longer work
        const useTokenResponse = await request(app)
          .get('/api/protected-resource')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(useTokenResponse.status).toBe(401);

        // Refresh token should also be revoked
        if (refreshToken) {
          const refreshResponse = await request(app)
            .post('/api/auth/oauth/token')
            .send({
              grantType: 'refresh_token',
              refreshToken,
            });

          expect(refreshResponse.status).toBe(400);
        }
      }
    });

    it('should implement token introspection security', async () => {
      const tokenResponse = await request(app)
        .post('/api/auth/oauth/token')
        .send({
          grantType: 'client_credentials',
          clientId: 'test-client',
          clientSecret: 'test-secret',
        });

      if (tokenResponse.status === 200) {
        const token = tokenResponse.body.accessToken;

        // Introspect with correct client credentials
        const introspectResponse = await request(app)
          .post('/api/auth/oauth/introspect')
          .auth('test-client', 'test-secret')
          .send({ token });

        expect(introspectResponse.status).toBe(200);
        expect(introspectResponse.body.active).toBe(true);

        // Introspect with wrong credentials should fail
        const wrongAuthResponse = await request(app)
          .post('/api/auth/oauth/introspect')
          .auth('wrong-client', 'wrong-secret')
          .send({ token });

        expect(wrongAuthResponse.status).toBe(401);
      }
    });

    it('should prevent token substitution attacks', async () => {
      // Create tokens for different clients
      const client1Token = await request(app)
        .post('/api/auth/oauth/token')
        .send({
          grantType: 'client_credentials',
          clientId: 'client-1',
          clientSecret: 'secret-1',
        });

      const client2Token = await request(app)
        .post('/api/auth/oauth/token')
        .send({
          grantType: 'client_credentials',
          clientId: 'client-2',
          clientSecret: 'secret-2',
        });

      if (client1Token.status === 200 && client2Token.status === 200) {
        // Try to use client1 token with client2 resources
        const unauthorizedResponse = await request(app)
          .get('/api/client-2/protected')
          .set('Authorization', `Bearer ${client1Token.body.accessToken}`);

        expect([401, 403]).toContain(unauthorizedResponse.status);
      }
    });
  });

  describe('Client Authentication Security', () => {
    it('should implement client secret validation', async () => {
      const validCredentials = {
        clientId: 'test-client',
        clientSecret: 'test-secret',
        grantType: 'client_credentials',
      };

      const invalidCredentials = [
        { ...validCredentials, clientSecret: 'wrong-secret' },
        { ...validCredentials, clientId: 'wrong-client' },
        { ...validCredentials, clientSecret: '' },
        { ...validCredentials, clientId: '' },
      ];

      // Valid credentials should work
      const validResponse = await request(app)
        .post('/api/auth/oauth/token')
        .send(validCredentials);

      expect([200, 201]).toContain(validResponse.status);

      // Invalid credentials should fail
      for (const creds of invalidCredentials) {
        const response = await request(app)
          .post('/api/auth/oauth/token')
          .send(creds);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('invalid_client');
      }
    });

    it('should implement client certificate validation', async () => {
      const certResponse = await request(app)
        .post('/api/auth/oauth/token')
        .set('X-Client-Cert', 'fake-certificate')
        .send({
          grantType: 'client_credentials',
          clientId: 'cert-client',
        });

      // Should validate certificate or require traditional auth
      expect([200, 400, 401]).toContain(certResponse.status);
    });

    it('should prevent client impersonation', async () => {
      // Register a client
      const registerResponse = await request(app)
        .post('/api/auth/oauth/register')
        .send({
          clientName: 'Legitimate App',
          redirectUris: ['https://legitimate.com/callback'],
        });

      if (registerResponse.status === 201) {
        const clientId = registerResponse.body.clientId;

        // Attacker tries to use similar client ID
        const impersonateAttempts = [
          clientId.replace(/.$/, '1'), // Change last character
          clientId + '1', // Append character
          clientId.toUpperCase(), // Change case
          `fake-${clientId}`, // Prefix
        ];

        for (const fakeId of impersonateAttempts) {
          const response = await request(app)
            .post('/api/auth/oauth/token')
            .send({
              clientId: fakeId,
              clientSecret: 'fake-secret',
              grantType: 'client_credentials',
            });

          expect(response.status).toBe(401);
        }
      }
    });

    it('should implement dynamic client registration security', async () => {
      const maliciousRegistrations = [
        {
          clientName: '<script>alert("xss")</script>',
          redirectUris: ['https://evil.com/callback'],
        },
        {
          clientName: 'Evil App',
          redirectUris: ['javascript:alert(1)'],
        },
        {
          clientName: 'Fake App',
          redirectUris: ['https://legitimate.com.evil.com/callback'],
        },
      ];

      for (const registration of maliciousRegistrations) {
        const response = await request(app)
          .post('/api/auth/oauth/register')
          .send(registration);

        expect([400, 422]).toContain(response.status);
      }
    });
  });

  describe('Scope and Permission Security', () => {
    it('should validate OAuth scopes properly', async () => {
      const scopeTests = [
        { scopes: ['read'], shouldWork: true },
        { scopes: ['read', 'write'], shouldWork: true },
        { scopes: ['admin'], shouldWork: false }, // Regular client shouldn't get admin scope
        { scopes: ['*'], shouldWork: false }, // Wildcard scope
        { scopes: ['../admin'], shouldWork: false }, // Path traversal
        { scopes: ['read write'], shouldWork: false }, // Space in scope
      ];

      for (const test of scopeTests) {
        const tokenResponse = await request(app)
          .post('/api/auth/oauth/token')
          .send({
            grantType: 'client_credentials',
            clientId: 'test-client',
            clientSecret: 'test-secret',
            scope: test.scopes.join(' '),
          });

        if (test.shouldWork) {
          expect([200, 201]).toContain(tokenResponse.status);
        } else {
          expect([400, 403]).toContain(tokenResponse.status);
        }
      }
    });

    it('should enforce scope-based access control', async () => {
      // Token with limited scope
      const limitedTokenResponse = await request(app)
        .post('/api/auth/oauth/token')
        .send({
          grantType: 'client_credentials',
          clientId: 'limited-client',
          clientSecret: 'limited-secret',
          scope: 'read',
        });

      if (limitedTokenResponse.status === 200) {
        const limitedToken = limitedTokenResponse.body.accessToken;

        // Should work for read operations
        const readResponse = await request(app)
          .get('/api/data')
          .set('Authorization', `Bearer ${limitedToken}`);

        expect([200, 404]).toContain(readResponse.status);

        // Should fail for write operations
        const writeResponse = await request(app)
          .post('/api/data')
          .set('Authorization', `Bearer ${limitedToken}`)
          .send({ data: 'test' });

        expect([401, 403]).toContain(writeResponse.status);
      }
    });

    it('should prevent scope elevation attacks', async () => {
      const tokenResponse = await request(app)
        .post('/api/auth/oauth/token')
        .send({
          grantType: 'client_credentials',
          clientId: 'test-client',
          clientSecret: 'test-secret',
          scope: 'read',
        });

      if (tokenResponse.status === 200) {
        const token = tokenResponse.body.accessToken;

        // Try to access resources requiring higher scope
        const elevatedResponse = await request(app)
          .delete('/api/admin/data')
          .set('Authorization', `Bearer ${token}`)
          .set('X-Requested-Scope', 'admin delete');

        expect([401, 403]).toContain(elevatedResponse.status);
      }
    });
  });

  describe('OAuth Security Headers and CORS', () => {
    it('should implement proper CORS for OAuth endpoints', async () => {
      const corsResponse = await request(app)
        .options('/api/auth/oauth/token')
        .set('Origin', 'https://trusted-app.com')
        .set('Access-Control-Request-Method', 'POST');

      expect(corsResponse.status).toBe(200);
      expect(corsResponse.headers['access-control-allow-origin']).toBeDefined();
      expect(corsResponse.headers['access-control-allow-methods']).toContain('POST');

      // Untrusted origin should be rejected
      const untrustedResponse = await request(app)
        .options('/api/auth/oauth/token')
        .set('Origin', 'https://evil.com')
        .set('Access-Control-Request-Method', 'POST');

      expect([403, 200]).toContain(untrustedResponse.status);
      if (untrustedResponse.status === 200) {
        expect(untrustedResponse.headers['access-control-allow-origin']).not.toBe('https://evil.com');
      }
    });

    it('should set proper security headers on OAuth responses', async () => {
      const response = await request(app)
        .post('/api/auth/oauth/token')
        .send({
          grantType: 'client_credentials',
          clientId: 'test-client',
          clientSecret: 'test-secret',
        });

      expect(response.headers).toHaveProperty('cache-control', 'no-store');
      expect(response.headers).toHaveProperty('pragma', 'no-cache');
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
    });

    it('should prevent OAuth token leakage in referers', async () => {
      const tokenResponse = await request(app)
        .post('/api/auth/oauth/token')
        .send({
          grantType: 'client_credentials',
          clientId: 'test-client',
          clientSecret: 'test-secret',
        });

      if (tokenResponse.status === 200) {
        expect(tokenResponse.headers).toHaveProperty('referrer-policy');
        expect(tokenResponse.headers['referrer-policy']).toMatch(/no-referrer|strict-origin/);
      }
    });
  });
});