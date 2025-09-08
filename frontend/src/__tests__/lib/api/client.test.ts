import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient, apiClient } from '../../lib/api/client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock shared package errors
vi.mock('@medianest/shared', () => ({
  AppError: class MockAppError extends Error {
    constructor(
      message: string,
      public status?: number,
      public code?: string,
      public details?: any
    ) {
      super(message);
      this.name = 'AppError';
    }
  },
  AuthenticationError: class MockAuthenticationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthenticationError';
    }
  },
  ValidationError: class MockValidationError extends Error {
    constructor(message: string, public details?: any) {
      super(message);
      this.name = 'ValidationError';
    }
  },
  RateLimitError: class MockRateLimitError extends Error {
    constructor(public retryAfter?: number) {
      super('Rate limit exceeded');
      this.name = 'RateLimitError';
    }
  },
  ServiceUnavailableError: class MockServiceUnavailableError extends Error {
    constructor(service: string) {
      super(`Service ${service} is unavailable`);
      this.name = 'ServiceUnavailableError';
    }
  },
}));

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default values', () => {
      const client = new ApiClient();
      expect(client).toBeInstanceOf(ApiClient);
    });

    it('should create instance with custom baseUrl and timeout', () => {
      const client = new ApiClient('https://api.example.com', 5000);
      expect(client).toBeInstanceOf(ApiClient);
    });
  });

  describe('GET requests', () => {
    it('should handle successful GET request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockResolvedValue({ data: { id: 1, name: 'Test' } }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.get('/test');

      expect(fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'GET',
          cache: 'default',
        })
      );
      expect(result).toEqual({ id: 1, name: 'Test' });
    });

    it('should handle GET request with query parameters', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockResolvedValue({ data: [] }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await apiClient.get('/test', { params: { page: '1', limit: '10' } });

      expect(fetch).toHaveBeenCalledWith('/api/test?page=1&limit=10', expect.any(Object));
    });

    it('should handle GET request with cache options', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockResolvedValue({ data: [] }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await apiClient.get('/test', { cache: 'no-cache', revalidate: 60 });

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall?.[1]?.cache).toBe('no-cache');
      expect(fetchCall?.[1]?.headers?.['Cache-Control']).toContain('max-age=60');
    });
  });

  describe('POST requests', () => {
    it('should handle successful POST request', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockResolvedValue({ data: { id: 1 } }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const payload = { name: 'Test Item' };
      const result = await apiClient.post('/items', payload);

      expect(fetch).toHaveBeenCalledWith(
        '/api/items',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(payload),
        })
      );
      expect(result).toEqual({ id: 1 });
    });

    it('should handle POST request without body', async () => {
      const mockResponse = {
        ok: true,
        status: 204,
        headers: new Headers(),
        json: vi.fn(),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.post('/action');

      expect(fetch).toHaveBeenCalledWith(
        '/api/action',
        expect.objectContaining({
          method: 'POST',
          body: undefined,
        })
      );
      expect(result).toEqual({});
    });
  });

  describe('Error handling', () => {
    it('should throw ValidationError for 400 status', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockResolvedValue({
          error: { message: 'Invalid input', details: { field: 'name' } },
        }),
        url: '/api/test',
        statusText: 'Bad Request',
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(apiClient.get('/test')).rejects.toThrow('Invalid input');
    });

    it('should throw AuthenticationError for 401 status', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockResolvedValue({
          error: { message: 'Unauthorized' },
        }),
        url: '/api/test',
        statusText: 'Unauthorized',
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(apiClient.get('/test')).rejects.toThrow('Unauthorized');
    });

    it('should throw RateLimitError for 429 status', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockResolvedValue({
          error: { message: 'Rate limit exceeded', retryAfter: 60 },
        }),
        url: '/api/test',
        statusText: 'Too Many Requests',
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(apiClient.get('/test')).rejects.toThrow('Rate limit exceeded');
    });

    it('should throw ServiceUnavailableError for 503 status', async () => {
      const mockResponse = {
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockResolvedValue({
          error: { message: 'Service unavailable' },
        }),
        url: '/api/test',
        statusText: 'Service Unavailable',
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(apiClient.get('/test')).rejects.toThrow('Service API is unavailable');
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('AbortError'));
      mockFetch.mockRejectedValueOnce({ name: 'AbortError' });

      await expect(apiClient.get('/test', { timeout: 100 })).rejects.toThrow('Request timeout');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      await expect(apiClient.get('/test')).rejects.toThrow('Network error');
    });

    it('should handle non-JSON error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: vi.fn().mockResolvedValue('Internal Server Error'),
        json: vi.fn(),
        url: '/api/test',
        statusText: 'Internal Server Error',
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(apiClient.get('/test')).rejects.toThrow();
    });
  });

  describe('HTTP methods', () => {
    beforeEach(() => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockResolvedValue({ data: { success: true } }),
      };
      mockFetch.mockResolvedValue(mockResponse);
    });

    it('should handle PUT requests', async () => {
      const payload = { id: 1, name: 'Updated' };
      await apiClient.put('/items/1', payload);

      expect(fetch).toHaveBeenCalledWith(
        '/api/items/1',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(payload),
        })
      );
    });

    it('should handle PATCH requests', async () => {
      const payload = { name: 'Patched' };
      await apiClient.patch('/items/1', payload);

      expect(fetch).toHaveBeenCalledWith(
        '/api/items/1',
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(payload),
        })
      );
    });

    it('should handle DELETE requests', async () => {
      await apiClient.delete('/items/1');

      expect(fetch).toHaveBeenCalledWith(
        '/api/items/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('Default instance', () => {
    it('should export a default apiClient instance', () => {
      expect(apiClient).toBeInstanceOf(ApiClient);
    });
  });

  describe('Response handling', () => {
    it('should handle API response with success=false', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockResolvedValue({
          success: false,
          error: { message: 'Business logic error' },
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(apiClient.get('/test')).rejects.toBeDefined();
    });

    it('should handle 204 No Content responses', async () => {
      const mockResponse = {
        ok: true,
        status: 204,
        headers: new Headers(),
        json: vi.fn(),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.get('/test');
      expect(result).toEqual({});
    });

    it('should handle non-JSON success responses', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        json: vi.fn(),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.get('/test');
      expect(result).toEqual({});
    });
  });
});
