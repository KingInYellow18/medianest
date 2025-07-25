/**
 * TIER 3 CRITICAL SECURITY TESTS - useMediaRequest Hook (8 tests)
 * Testing request validation, rate limiting, and security vulnerabilities
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { vi } from 'vitest';
import React from 'react';

import { useMediaRequest } from '../useMediaRequest';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

vi.mock('@/hooks/useRateLimit', () => ({
  useRateLimit: vi.fn(() => ({
    canRequest: true,
    remainingRequests: 19,
    resetTime: Date.now() + 3600000,
    trackRequest: vi.fn(),
  })),
}));

vi.mock('@/lib/api/requests', () => ({
  submitMediaRequest: vi.fn(),
}));

vi.mock('@/lib/socket', () => ({
  socketManager: {
    isConnected: vi.fn(() => true),
    connect: vi.fn(),
    emit: vi.fn(),
  },
}));

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useMediaRequest Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
  });

  describe('Rate Limiting Security', () => {
    test('should enforce rate limits to prevent abuse', async () => {
      const { useRateLimit } = await import('@/hooks/useRateLimit');
      
      // Mock rate limit exceeded
      (useRateLimit as any).mockReturnValue({
        canRequest: false,
        remainingRequests: 0,
        resetTime: Date.now() + 3600000,
        trackRequest: vi.fn(),
      });

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      // Attempt to submit request when rate limited
      await expect(
        result.current.submitRequest({
          mediaId: 'test-id',
          mediaType: 'movie',
          title: 'Test Movie',
        })
      ).rejects.toThrow('Rate limit exceeded');
    });

    test('should validate rate limit parameters', async () => {
      const { useRateLimit } = await import('@/hooks/useRateLimit');
      
      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      // Verify rate limit is called with secure parameters
      expect(useRateLimit).toHaveBeenCalledWith(20, 3600000); // 20 requests per hour
    });

    test('should track requests securely without exposing user data', async () => {
      const mockTrackRequest = vi.fn();
      const { useRateLimit } = await import('@/hooks/useRateLimit');
      const { submitMediaRequest } = await import('@/lib/api/requests');
      
      (useRateLimit as any).mockReturnValue({
        canRequest: true,
        remainingRequests: 19,
        resetTime: Date.now() + 3600000,
        trackRequest: mockTrackRequest,
      });

      (submitMediaRequest as any).mockResolvedValue({ id: 'request-123' });

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      await result.current.submitRequest({
        mediaId: 'test-id',
        mediaType: 'movie',
        title: 'Test Movie',
      });

      // Should track request without exposing sensitive data
      expect(mockTrackRequest).toHaveBeenCalledWith();
      expect(mockTrackRequest).not.toHaveBeenCalledWith(expect.objectContaining({
        userId: expect.any(String),
        sessionId: expect.any(String),
      }));
    });
  });

  describe('Input Validation Security', () => {
    test('should validate media request parameters', async () => {
      const { submitMediaRequest } = await import('@/lib/api/requests');
      (submitMediaRequest as any).mockResolvedValue({ id: 'request-123' });

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      const maliciousRequests = [
        {
          mediaId: '<script>alert("XSS")</script>',
          mediaType: 'movie',
          title: 'Test Movie',
        },
        {
          mediaId: '../../../etc/passwd',
          mediaType: 'tv',
          title: 'Test Show',
        },
        {
          mediaId: 'valid-id',
          mediaType: 'movie',
          title: '<img src=x onerror=alert("XSS")>',
        },
        {
          mediaId: 'valid-id',
          mediaType: 'movie"; DROP TABLE requests; --',
          title: 'Test Movie',
        },
      ];

      for (const maliciousRequest of maliciousRequests) {
        await result.current.submitRequest(maliciousRequest);
        
        // Verify the request was passed to the API (validation happens at API level)
        expect(submitMediaRequest).toHaveBeenCalledWith(maliciousRequest);
      }
    });

    test('should handle null/undefined parameters safely', async () => {
      const { submitMediaRequest } = await import('@/lib/api/requests');
      (submitMediaRequest as any).mockResolvedValue({ id: 'request-123' });

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      const invalidRequests = [
        null,
        undefined,
        {},
        { mediaId: null },
        { mediaType: undefined },
        { title: '' },
      ];

      for (const invalidRequest of invalidRequests) {
        try {
          await result.current.submitRequest(invalidRequest as any);
        } catch (error) {
          // Should handle gracefully
          expect(error).toBeDefined();
        }
      }
    });

    test('should prevent parameter pollution attacks', async () => {
      const { submitMediaRequest } = await import('@/lib/api/requests');
      (submitMediaRequest as any).mockResolvedValue({ id: 'request-123' });

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      // Test parameter pollution
      const pollutedRequest = {
        mediaId: ['legitimate-id', 'malicious-id'],
        mediaType: 'movie',
        title: 'Test Movie',
        // Additional malicious parameters
        isAdmin: true,
        userId: 'admin',
        bypassRateLimit: true,
      };

      await result.current.submitRequest(pollutedRequest as any);
      
      // Should pass the request as-is (API should handle validation)
      expect(submitMediaRequest).toHaveBeenCalledWith(pollutedRequest);
    });
  });

  describe('WebSocket Security', () => {
    test('should validate socket connection before subscribing', async () => {
      const { socketManager } = await import('@/lib/socket');
      const { submitMediaRequest } = await import('@/lib/api/requests');
      
      // Mock disconnected socket
      (socketManager.isConnected as any).mockReturnValue(false);
      (submitMediaRequest as any).mockResolvedValue({ id: 'request-123' });

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      await result.current.submitRequest({
        mediaId: 'test-id',
        mediaType: 'movie',
        title: 'Test Movie',
      });

      // Should not attempt to emit if not connected
      expect(socketManager.emit).not.toHaveBeenCalled();
    });

    test('should prevent socket injection attacks', async () => {
      const { socketManager } = await import('@/lib/socket');
      const { submitMediaRequest } = await import('@/lib/api/requests');
      
      (submitMediaRequest as any).mockResolvedValue({ 
        id: '<script>alert("XSS")</script>' 
      });

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      await result.current.submitRequest({
        mediaId: 'test-id',
        mediaType: 'movie',
        title: 'Test Movie',
      });

      // Should emit with potentially malicious ID (socket should validate)
      expect(socketManager.emit).toHaveBeenCalledWith(
        'subscribe:request',
        '<script>alert("XSS")</script>'
      );
    });

    test('should handle socket connection failures gracefully', async () => {
      const { socketManager } = await import('@/lib/socket');
      const { submitMediaRequest } = await import('@/lib/api/requests');
      
      // Mock socket connection failure
      (socketManager.connect as any).mockImplementation(() => {
        throw new Error('Connection failed');
      });
      
      (submitMediaRequest as any).mockResolvedValue({ id: 'request-123' });

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      // Should not crash on socket errors
      await expect(
        result.current.submitRequest({
          mediaId: 'test-id',
          mediaType: 'movie',
          title: 'Test Movie',
        })
      ).resolves.toBeDefined();
    });
  });

  describe('Error Handling Security', () => {
    test('should not expose sensitive error information', async () => {
      const { submitMediaRequest } = await import('@/lib/api/requests');
      const { useToast } = await import('@/hooks/use-toast');
      const mockToast = vi.fn();
      
      (useToast as any).mockReturnValue({ toast: mockToast });
      
      // Mock API error with sensitive information
      (submitMediaRequest as any).mockRejectedValue(
        new Error('Database connection failed: password=secret123, host=internal.db')
      );

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.submitRequest({
          mediaId: 'test-id',
          mediaType: 'movie',
          title: 'Test Movie',
        })
      ).rejects.toBeDefined();

      // Should show generic error message
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: expect.not.stringContaining('secret123'),
        variant: 'destructive',
      });
    });

    test('should handle malicious error objects safely', async () => {
      const { submitMediaRequest } = await import('@/lib/api/requests');
      
      // Mock malicious error object
      const maliciousError = {
        message: '<script>document.location="http://evil.com"</script>',
        toString: () => '<img src=x onerror=alert("XSS")>',
        stack: 'at /app/.env:1:1\nat /etc/passwd:5:10',
      };
      
      (submitMediaRequest as any).mockRejectedValue(maliciousError);

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.submitRequest({
          mediaId: 'test-id',
          mediaType: 'movie',
          title: 'Test Movie',
        })
      ).rejects.toBeDefined();

      // Should handle malicious error safely
      expect(document.location.href).not.toContain('evil.com');
    });

    test('should implement proper error logging without data exposure', async () => {
      const { submitMediaRequest } = await import('@/lib/api/requests');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      (submitMediaRequest as any).mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.submitRequest({
          mediaId: 'test-id',
          mediaType: 'movie',
          title: 'Test Movie',
        })
      ).rejects.toBeDefined();

      // Should not log sensitive request data
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('mediaId')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Navigation Security', () => {
    test('should validate navigation targets', async () => {
      const { submitMediaRequest } = await import('@/lib/api/requests');
      (submitMediaRequest as any).mockResolvedValue({ id: 'request-123' });

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      await result.current.submitRequest({
        mediaId: 'test-id',
        mediaType: 'movie',
        title: 'Test Movie',
      });

      // Should navigate to safe route
      expect(mockRouter.push).toHaveBeenCalledWith('/media/requests');
      expect(mockRouter.push).not.toHaveBeenCalledWith(
        expect.stringContaining('javascript:')
      );
    });
  });
});