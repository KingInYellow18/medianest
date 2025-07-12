import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getServerSession } from 'next-auth';

import { getAuthOptions } from '@/lib/auth/auth.config';
import { RequestSubmission, MediaRequest } from '@/types/requests';

import { submitMediaRequest, getUserRequests, getRequestDetails, cancelRequest } from '../requests';

// Mock dependencies
vi.mock('next-auth');
vi.mock('@/lib/auth/auth.config');

// Mock global fetch
global.fetch = vi.fn();

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

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await submitMediaRequest(request);

      expect(global.fetch).toHaveBeenCalledWith('/api/media/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await submitMediaRequest(request);

      expect(global.fetch).toHaveBeenCalledWith('/api/media/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors', async () => {
      const request: RequestSubmission = {
        mediaType: 'movie',
        tmdbId: 550,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Invalid request' }),
      } as Response);

      await expect(submitMediaRequest(request)).rejects.toThrow('Failed to submit request');
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

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRequests,
      } as Response);

      const result = await getUserRequests();

      expect(global.fetch).toHaveBeenCalledWith('/api/media/requests');
      expect(result).toEqual(mockRequests);
    });

    it('should handle empty results', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

      const result = await getUserRequests();

      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      } as Response);

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

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRequest,
      } as Response);

      const result = await getRequestDetails(requestId);

      expect(global.fetch).toHaveBeenCalledWith(`/api/media/requests/${requestId}`);
      expect(result).toEqual(mockRequest);
    });

    it('should handle not found errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(getRequestDetails('non-existent')).rejects.toThrow('Failed to fetch request details');
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

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRequest,
      } as Response);

      const result = await getRequestDetails(requestId);

      expect(result).toEqual(mockRequest);
      expect(result.seasons).toHaveLength(3);
    });
  });

  describe('cancelRequest', () => {
    it('should cancel request successfully', async () => {
      const requestId = 'req-123';

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

      await cancelRequest(requestId);

      expect(global.fetch).toHaveBeenCalledWith(`/api/media/requests/${requestId}`, {
        method: 'DELETE',
      });
    });

    it('should handle unauthorized errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as Response);

      await expect(cancelRequest('req-123')).rejects.toThrow('Failed to cancel request');
    });

    it('should handle already processed requests', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Cannot cancel request in current state' }),
      } as Response);

      await expect(cancelRequest('req-123')).rejects.toThrow('Failed to cancel request');
    });
  });

  describe('error handling', () => {
    it('should include error details when available', async () => {
      const request: RequestSubmission = {
        mediaType: 'movie',
        tmdbId: 550,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Rate limit exceeded', details: 'Try again in 5 minutes' }),
      } as Response);

      await expect(submitMediaRequest(request)).rejects.toThrow('Failed to submit request');
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
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 0)
        )
      );

      await expect(getUserRequests()).rejects.toThrow('Request timeout');
    });
  });
});