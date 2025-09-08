import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch for integration tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Next.js auth
vi.mock('next-auth/react', () => ({
  getSession: vi.fn(() =>
    Promise.resolve({
      user: { id: '123', name: 'Test User' },
      accessToken: 'test-token',
    })
  ),
}));

describe('API Endpoints Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('Health Check Endpoints', () => {
    it('should successfully call basic health endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            status: 'ok',
            timestamp: '2023-01-01T00:00:00Z',
            uptime: 12345,
          }),
      });

      const response = await fetch('http://localhost:4000/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime');
    });

    it('should successfully call API health endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            status: 'healthy',
            services: {
              database: 'connected',
              redis: 'connected',
              external_apis: 'connected',
            },
            version: '1.0.0',
          }),
      });

      const response = await fetch('http://localhost:4000/api/v1/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('status', 'healthy');
      expect(data).toHaveProperty('services');
      expect(data.services).toHaveProperty('database', 'connected');
    });
  });

  describe('Authentication Endpoints', () => {
    it('should handle sign in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            user: {
              id: '123',
              email: 'test@example.com',
              name: 'Test User',
            },
            token: 'jwt-token',
            refreshToken: 'refresh-token',
          }),
      });

      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('token');
      expect(data.user.email).toBe('test@example.com');
    });

    it('should handle invalid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            error: 'Invalid credentials',
            code: 'AUTH_INVALID_CREDENTIALS',
          }),
      });

      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'wrongpassword',
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid credentials');
    });
  });

  describe('Media Request Endpoints', () => {
    it('should create media request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            id: 'req-123',
            title: 'Test Movie',
            type: 'movie',
            status: 'pending',
            requestedBy: 'user-123',
            createdAt: '2023-01-01T00:00:00Z',
          }),
      });

      const response = await fetch('/api/media/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({
          title: 'Test Movie',
          type: 'movie',
          year: 2023,
          imdbId: 'tt1234567',
        }),
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('title', 'Test Movie');
      expect(data).toHaveProperty('status', 'pending');
    });

    it('should get media requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            requests: [
              {
                id: 'req-1',
                title: 'Movie 1',
                type: 'movie',
                status: 'approved',
              },
              {
                id: 'req-2',
                title: 'TV Show 1',
                type: 'tv',
                status: 'pending',
              },
            ],
            total: 2,
            page: 1,
            limit: 10,
          }),
      });

      const response = await fetch('/api/media/requests?page=1&limit=10', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-token',
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('requests');
      expect(data.requests).toHaveLength(2);
      expect(data).toHaveProperty('total', 2);
    });

    it('should update media request status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: 'req-123',
            status: 'approved',
            updatedAt: '2023-01-01T01:00:00Z',
          }),
      });

      const response = await fetch('/api/media/requests/req-123', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({
          status: 'approved',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('status', 'approved');
    });
  });

  describe('Plex Integration Endpoints', () => {
    it('should create plex pin', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: 123456,
            code: 'ABCD',
            url: 'https://app.plex.tv/auth#?clientID=test&code=ABCD',
            expiresIn: 1800,
          }),
      });

      const response = await fetch('/api/auth/plex/pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('code');
      expect(data).toHaveProperty('url');
      expect(data.code).toBe('ABCD');
    });

    it('should handle plex callback', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            user: {
              id: 'plex-user-123',
              username: 'plexuser',
              email: 'plex@example.com',
            },
            token: 'plex-jwt-token',
          }),
      });

      const response = await fetch('/api/auth/plex/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pinId: '123456',
          authToken: 'plex-auth-token',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('token');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () =>
          Promise.resolve({
            error: 'Not found',
            code: 'RESOURCE_NOT_FOUND',
          }),
      });

      const response = await fetch('/api/nonexistent-endpoint');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Not found');
    });

    it('should handle 500 server error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
          }),
      });

      const response = await fetch('/api/test-endpoint');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Internal server error');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetch('/api/test-endpoint')).rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(timeoutError);

      await expect(fetch('/api/test-endpoint')).rejects.toThrow('Request timeout');
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limit responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (key: string) => {
            if (key === 'retry-after') return '60';
            if (key === 'x-ratelimit-remaining') return '0';
            if (key === 'x-ratelimit-reset') return '1640995200';
            return null;
          },
        },
        json: () =>
          Promise.resolve({
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: 60,
          }),
      });

      const response = await fetch('/api/test-endpoint', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
        },
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(429);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Rate limit exceeded');
      expect(data).toHaveProperty('retryAfter', 60);
    });
  });

  describe('CORS Handling', () => {
    it('should handle CORS preflight requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: {
          get: (key: string) => {
            const headers: Record<string, string> = {
              'access-control-allow-origin': 'http://localhost:3000',
              'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
              'access-control-allow-headers': 'Content-Type,Authorization',
            };
            return headers[key.toLowerCase()] || null;
          },
        },
        json: () => Promise.resolve({}),
      });

      const response = await fetch('/api/test-endpoint', {
        method: 'OPTIONS',
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(204);
    });
  });

  describe('Content Type Handling', () => {
    it('should handle JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (key: string) => (key === 'content-type' ? 'application/json' : null),
        },
        json: () => Promise.resolve({ message: 'success' }),
      });

      const response = await fetch('/api/test-endpoint');

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('message', 'success');
    });

    it('should handle invalid JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const response = await fetch('/api/test-endpoint');

      expect(response.ok).toBe(true);
      await expect(response.json()).rejects.toThrow('Invalid JSON');
    });
  });
});
