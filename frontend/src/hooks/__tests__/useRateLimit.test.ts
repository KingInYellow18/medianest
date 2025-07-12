import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useRateLimit } from '../useRateLimit';

describe('useRateLimit', () => {
  const STORAGE_KEY = 'mediaRequestTimestamps';
  const MAX_REQUESTS = 20;
  const WINDOW_MS = 3600000; // 1 hour

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    // Mock current time
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests when under the limit', () => {
    const { result } = renderHook(() => useRateLimit());

    expect(result.current.canRequest).toBe(true);
    expect(result.current.remainingRequests).toBe(MAX_REQUESTS);
  });

  it('should track requests and update remaining count', () => {
    const { result } = renderHook(() => useRateLimit());

    act(() => {
      result.current.trackRequest();
    });

    expect(result.current.remainingRequests).toBe(MAX_REQUESTS - 1);
    expect(result.current.canRequest).toBe(true);

    // Check localStorage
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toBe(new Date('2023-01-01T12:00:00Z').getTime());
  });

  it('should prevent requests when limit is reached', () => {
    const { result } = renderHook(() => useRateLimit());

    // Track MAX_REQUESTS
    act(() => {
      for (let i = 0; i < MAX_REQUESTS; i++) {
        result.current.trackRequest();
      }
    });

    expect(result.current.canRequest).toBe(false);
    expect(result.current.remainingRequests).toBe(0);
  });

  it('should calculate correct reset time', () => {
    const { result } = renderHook(() => useRateLimit());

    act(() => {
      result.current.trackRequest();
    });

    // Reset time should be 1 hour from the first request
    const expectedResetTime = new Date('2023-01-01T13:00:00Z');
    expect(result.current.resetTime?.getTime()).toBe(expectedResetTime.getTime());
  });

  it('should clean up old requests outside the window', () => {
    const { result } = renderHook(() => useRateLimit());

    // Add some requests
    act(() => {
      result.current.trackRequest();
      result.current.trackRequest();
    });

    expect(result.current.remainingRequests).toBe(MAX_REQUESTS - 2);

    // Move time forward by 1 hour and 1 minute
    act(() => {
      vi.setSystemTime(new Date('2023-01-01T13:01:00Z'));
    });

    // Re-render to trigger cleanup
    const { result: newResult } = renderHook(() => useRateLimit());

    expect(newResult.current.remainingRequests).toBe(MAX_REQUESTS);
    expect(newResult.current.canRequest).toBe(true);
  });

  it('should persist requests across component remounts', () => {
    const { result, unmount } = renderHook(() => useRateLimit());

    // Track some requests
    act(() => {
      result.current.trackRequest();
      result.current.trackRequest();
      result.current.trackRequest();
    });

    expect(result.current.remainingRequests).toBe(MAX_REQUESTS - 3);

    // Unmount and remount
    unmount();
    const { result: newResult } = renderHook(() => useRateLimit());

    expect(newResult.current.remainingRequests).toBe(MAX_REQUESTS - 3);
  });

  it('should handle empty localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, '');

    const { result } = renderHook(() => useRateLimit());

    expect(result.current.canRequest).toBe(true);
    expect(result.current.remainingRequests).toBe(MAX_REQUESTS);
  });

  it('should handle invalid localStorage data', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid-json');

    const { result } = renderHook(() => useRateLimit());

    expect(result.current.canRequest).toBe(true);
    expect(result.current.remainingRequests).toBe(MAX_REQUESTS);
  });

  it('should return null reset time when no requests', () => {
    const { result } = renderHook(() => useRateLimit());

    expect(result.current.resetTime).toBeNull();
  });

  it('should update reset time as requests expire', () => {
    const { result } = renderHook(() => useRateLimit());

    // Add requests at different times
    act(() => {
      result.current.trackRequest();
    });

    // Move forward 30 minutes
    act(() => {
      vi.setSystemTime(new Date('2023-01-01T12:30:00Z'));
      result.current.trackRequest();
    });

    // Reset time should still be based on the first request
    expect(result.current.resetTime?.getTime()).toBe(
      new Date('2023-01-01T13:00:00Z').getTime()
    );

    // Move forward past the first request's window
    act(() => {
      vi.setSystemTime(new Date('2023-01-01T13:01:00Z'));
    });

    // Re-render to trigger cleanup
    const { result: newResult } = renderHook(() => useRateLimit());

    // Reset time should now be based on the second request
    expect(newResult.current.resetTime?.getTime()).toBe(
      new Date('2023-01-01T13:30:00Z').getTime()
    );
  });

  it('should handle rapid successive requests', () => {
    const { result } = renderHook(() => useRateLimit());

    act(() => {
      // Track 10 requests rapidly
      for (let i = 0; i < 10; i++) {
        result.current.trackRequest();
      }
    });

    expect(result.current.remainingRequests).toBe(MAX_REQUESTS - 10);
    
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    expect(stored).toHaveLength(10);
    // All timestamps should be the same
    const uniqueTimestamps = new Set(stored);
    expect(uniqueTimestamps.size).toBe(1);
  });

  it('should maintain accurate count with mixed old and new requests', () => {
    const { result } = renderHook(() => useRateLimit());

    // Add 5 requests
    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.trackRequest();
      }
    });

    // Move forward 30 minutes
    act(() => {
      vi.setSystemTime(new Date('2023-01-01T12:30:00Z'));
    });

    // Add 5 more requests
    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.trackRequest();
      }
    });

    expect(result.current.remainingRequests).toBe(MAX_REQUESTS - 10);

    // Move forward to expire only the first batch
    act(() => {
      vi.setSystemTime(new Date('2023-01-01T13:01:00Z'));
    });

    // Re-render to trigger cleanup
    const { result: newResult } = renderHook(() => useRateLimit());

    // Should only have 5 requests remaining (the second batch)
    expect(newResult.current.remainingRequests).toBe(MAX_REQUESTS - 5);
  });
});