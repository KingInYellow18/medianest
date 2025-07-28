import { getServerSession } from 'next-auth';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { getAuthOptions } from '@/lib/auth/auth.config';
import { RequestSubmission, MediaRequest } from '@/types/requests';

import { submitMediaRequest, getUserRequests, getRequestDetails, cancelRequest } from '../requests';

// Mock dependencies
vi.mock('next-auth');
vi.mock('@/lib/auth/auth.config');

// Mock global fetch
global.fetch = vi.fn();

// Helper to mock fetch calls
const mockFetch = (responses: Record<string, { ok: boolean; json?: any; statusText?: string }>) => {
  vi.mocked(global.fetch).mockImplementation(async (url, options) => {
    const urlString = typeof url === 'string' ? url : url.toString();

    // Always handle auth session
    if (urlString === '/api/auth/session') {
      return {
        ok: true,
        json: async () => ({ accessToken: 'test-token' }),
      } as Response;
    }

    // Check for mocked responses
    const response = responses[urlString];
    if (response) {
      return {
        ok: response.ok,
        statusText: response.statusText || 'OK',
        json: response.json ? async () => response.json : undefined,
      } as Response;
    }

    throw new Error(`Unmocked fetch: ${urlString}`);
  });
};

describe('requests API', () => {
  const mockSession = {
    user: { id: 'user-123', email: 'test@example.com' },
    accessToken: 'mock-token-123',
  };

  const mockAuthOptions = { providers: [] };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthOptions).mockResolvedValue(mockAuthOptions);
    vi.mocked(getServerSession).mockResolvedValue(mockSession);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('submitMediaRequest', () => {
    it('should submit a movie request successfully', async () => {
      const request: RequestSubmission = {
        mediaType: 'movie',
        tmdbId: 550,
      };

      const mockResponse: MediaRequest = {
        id: 'req-123',
        userId: 'user-123',
        tmdbId: 550,
        mediaType: 'movie',
        title: 'Fight Club',
        overview: 'A great movie',
        posterPath: '/poster.jpg',
        backdropPath: '/backdrop.jpg',
        releaseDate: '1999-10-15',
        status: 'pending',
        requestedAt: '2023-01-01T12:00:00Z',
      };

      mockFetch({
        '/api/media/request': {
          ok: true,
          json: mockResponse,
        },
      });

      const result = await submitMediaRequest(request);

      expect(global.fetch).toHaveBeenCalledWith('/api/media/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify(request),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should submit a TV show request with seasons', async () => {
      const request: RequestSubmission = {
        mediaType: 'tv',
        tmdbId: 1396,
        seasons: [1, 2, 3],
      };

      const mockResponse: MediaRequest = {
        id: 'req-456',
        userId: 'user-123',
        tmdbId: 1396,
        mediaType: 'tv',
        title: 'Breaking Bad',
        overview: 'A chemistry teacher...',
        posterPath: '/poster.jpg',
        backdropPath: '/backdrop.jpg',
        releaseDate: '2008-01-20',
        status: 'pending',
        requestedAt: '2023-01-01T12:00:00Z',
        seasons: [
          { seasonNumber: 1, status: 'pending' },
          { seasonNumber: 2, status: 'pending' },
          { seasonNumber: 3, status: 'pending' },
        ],
      };

      mockFetch({
        '/api/media/request': {
          ok: true,
          json: mockResponse,
        },
      });

      const result = await submitMediaRequest(request);

      expect(global.fetch).toHaveBeenCalledWith('/api/media/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify(request),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors', async () => {
      const request: RequestSubmission = {
        mediaType: 'movie',
        tmdbId: 550,
      };

      mockFetch({
        '/api/media/request': {
          ok: false,
          statusText: 'Bad Request',
          json: { message: 'Invalid request' },
        },
      });

      await expect(submitMediaRequest(request)).rejects.toThrow('Invalid request');
    });

    it('should handle network errors', async () => {
      const request: RequestSubmission = {
        mediaType: 'movie',
        tmdbId: 550,
      };

      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      await expect(submitMediaRequest(request)).rejects.toThrow('Network error');
    });
  });

  describe('getUserRequests', () => {
    it('should fetch user requests successfully', async () => {
      const mockRequests: MediaRequest[] = [
        {
          id: 'req-1',
          userId: 'user-123',
          tmdbId: 550,
          mediaType: 'movie',
          title: 'Fight Club',
          overview: 'A great movie',
          posterPath: '/poster.jpg',
          backdropPath: '/backdrop.jpg',
          releaseDate: '1999-10-15',
          status: 'available',
          requestedAt: '2023-01-01T12:00:00Z',
        },
        {
          id: 'req-2',
          userId: 'user-123',
          tmdbId: 1396,
          mediaType: 'tv',
          title: 'Breaking Bad',
          overview: 'A chemistry teacher...',
          posterPath: '/poster.jpg',
          backdropPath: '/backdrop.jpg',
          releaseDate: '2008-01-20',
          status: 'pending',
          requestedAt: '2023-01-02T12:00:00Z',
        },
      ];

      mockFetch({
        '/api/media/requests': {
          ok: true,
          json: mockRequests,
        },
      });

      const result = await getUserRequests();

      expect(global.fetch).toHaveBeenCalledWith('/api/media/requests', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      });
      expect(result).toEqual(mockRequests);
    });

    it('should handle empty results', async () => {
      mockFetch({
        '/api/media/requests': {
          ok: true,
          json: [],
        },
      });

      const result = await getUserRequests();

      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      mockFetch({
        '/api/media/requests': {
          ok: false,
          statusText: 'Internal Server Error',
        },
      });

      await expect(getUserRequests()).rejects.toThrow('Failed to fetch requests');
    });
  });

  describe('getRequestDetails', () => {
    it('should fetch request details successfully', async () => {
      const requestId = 'req-123';
      const mockRequest: MediaRequest = {
        id: requestId,
        userId: 'user-123',
        tmdbId: 550,
        mediaType: 'movie',
        title: 'Fight Club',
        overview: 'A great movie',
        posterPath: '/poster.jpg',
        backdropPath: '/backdrop.jpg',
        releaseDate: '1999-10-15',
        status: 'available',
        requestedAt: '2023-01-01T12:00:00Z',
      };

      mockFetch({
        '/api/media/requests/req-123': {
          ok: true,
          json: mockRequest,
        },
      });

      const result = await getRequestDetails(requestId);

      expect(global.fetch).toHaveBeenCalledWith(`/api/media/requests/${requestId}`, {
        headers: {
          Authorization: 'Bearer test-token',
        },
      });
      expect(result).toEqual(mockRequest);
    });

    it('should handle not found errors', async () => {
      mockFetch({
        '/api/media/requests/non-existent': {
          ok: false,
          statusText: 'Not Found',
        },
      });

      await expect(getRequestDetails('non-existent')).rejects.toThrow(
        'Failed to fetch request details',
      );
    });

    it('should handle request with seasons', async () => {
      const requestId = 'req-456';
      const mockRequest: MediaRequest = {
        id: requestId,
        userId: 'user-123',
        tmdbId: 1396,
        mediaType: 'tv',
        title: 'Breaking Bad',
        overview: 'A chemistry teacher...',
        posterPath: '/poster.jpg',
        backdropPath: '/backdrop.jpg',
        releaseDate: '2008-01-20',
        status: 'partially-available',
        requestedAt: '2023-01-01T12:00:00Z',
        seasons: [
          { seasonNumber: 1, status: 'available' },
          { seasonNumber: 2, status: 'available' },
          { seasonNumber: 3, status: 'processing' },
        ],
      };

      mockFetch({
        [`/api/media/requests/${requestId}`]: {
          ok: true,
          json: mockRequest,
        },
      });

      const result = await getRequestDetails(requestId);

      expect(result).toEqual(mockRequest);
      expect(result.seasons).toHaveLength(3);
    });
  });

  describe('cancelRequest', () => {
    it('should cancel request successfully', async () => {
      const requestId = 'req-123';

      mockFetch({
        [`/api/media/requests/${requestId}`]: {
          ok: true,
          json: {},
        },
      });

      await cancelRequest(requestId);

      expect(global.fetch).toHaveBeenCalledWith(`/api/media/requests/${requestId}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer test-token',
        },
      });
    });

    it('should handle unauthorized errors', async () => {
      mockFetch({
        '/api/media/requests/req-123': {
          ok: false,
          statusText: 'Unauthorized',
          json: { message: 'Not authorized to cancel this request' },
        },
      });

      await expect(cancelRequest('req-123')).rejects.toThrow(
        'Not authorized to cancel this request',
      );
    });

    it('should handle already processed requests', async () => {
      mockFetch({
        '/api/media/requests/req-123': {
          ok: false,
          statusText: 'Bad Request',
          json: { message: 'Cannot cancel request in current state' },
        },
      });

      await expect(cancelRequest('req-123')).rejects.toThrow(
        'Cannot cancel request in current state',
      );
    });
  });

  describe('error handling', () => {
    it('should include error details when available', async () => {
      const request: RequestSubmission = {
        mediaType: 'movie',
        tmdbId: 550,
      };

      // Mock the getAuthToken fetch first
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: null }),
      } as Response);

      // Then mock the actual request
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Rate limit exceeded', details: 'Try again in 5 minutes' }),
      } as Response);

      await expect(submitMediaRequest(request)).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle JSON parse errors gracefully', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as Response);

      await expect(getUserRequests()).rejects.toThrow('Invalid JSON');
    });

    it('should handle timeout errors', async () => {
      vi.mocked(global.fetch).mockImplementationOnce(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 0)),
      );

      await expect(getUserRequests()).rejects.toThrow('Request timeout');
    });
  });
});
