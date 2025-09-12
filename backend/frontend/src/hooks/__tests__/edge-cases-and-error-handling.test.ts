import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import React from 'react';
import { useOptimizedState, useAsyncState, useDebouncedState } from '../useOptimizedState';
import { useOptimizedWebSocket } from '../useOptimizedWebSocket';

// Mock WebSocket for edge case testing
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  constructor() {
    // Simulate immediate connection for some tests
    if (Math.random() > 0.5) {
      setTimeout(() => {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.(new Event('open'));
      }, 1);
    }
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }

  simulateClose(code = 1000, reason = 'Normal closure') {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { code, reason }));
  }
}

beforeAll(() => {
  (global as any).WebSocket = MockWebSocket;
});

describe('Hook Edge Cases and Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useOptimizedState Edge Cases', () => {
    it('should handle null and undefined initial values', () => {
      const { result: nullResult } = renderHook(() => useOptimizedState(null));
      const { result: undefinedResult } = renderHook(() => useOptimizedState(undefined));

      expect(nullResult.current[0]).toBeNull();
      expect(undefinedResult.current[0]).toBeUndefined();
    });

    it('should handle extremely large objects', () => {
      const largeObject = {
        data: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item-${i}` })),
      };

      const { result } = renderHook(() => useOptimizedState(largeObject));

      expect(result.current[0].data.length).toBe(1000);

      act(() => {
        result.current[1]((prev) => ({
          ...prev,
          data: [...prev.data, { id: 1000, value: 'new-item' }],
        }));
      });

      expect(result.current[0].data.length).toBe(1001);
    });

    it('should handle functions as state values', () => {
      const initialFunction = () => 'initial';
      const { result } = renderHook(() => useOptimizedState(initialFunction));

      expect(typeof result.current[0]).toBe('function');
      expect(result.current[0]()).toBe('initial');

      const newFunction = () => 'updated';
      act(() => {
        result.current[1](newFunction);
      });

      expect(result.current[0]()).toBe('updated');
    });

    it('should handle rapid successive updates without race conditions', () => {
      const { result } = renderHook(() => useOptimizedState(0));

      act(() => {
        // Fire 100 updates rapidly
        for (let i = 0; i < 100; i++) {
          result.current[1]((prev) => prev + 1);
        }
      });

      expect(result.current[0]).toBe(100);
      expect(result.current[2].version).toBe(100);
    });
  });

  describe('useAsyncState Error Scenarios', () => {
    it('should handle network timeouts', async () => {
      const timeoutPromise = () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 100);
        });

      const { result } = renderHook(() => useAsyncState(timeoutPromise));

      let executeResult: any;
      await act(async () => {
        executeResult = await result.current.execute();
      });

      expect(executeResult.success).toBe(false);
      expect(executeResult.error.message).toBe('Request timeout');
      expect(result.current.error?.message).toBe('Request timeout');
    });

    it('should handle promise rejection with complex error objects', async () => {
      const complexError = {
        code: 'NETWORK_ERROR',
        message: 'Connection failed',
        details: { statusCode: 500, url: 'https://api.example.com' },
        timestamp: new Date(),
      };

      const failingFunction = () => Promise.reject(complexError);
      const { result } = renderHook(() => useAsyncState(failingFunction));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.error).toEqual(complexError);
    });

    it('should handle synchronous exceptions in async functions', async () => {
      const throwingFunction = () => {
        throw new Error('Synchronous error');
      };

      const { result } = renderHook(() => useAsyncState(throwingFunction));

      let executeResult: any;
      await act(async () => {
        executeResult = await result.current.execute();
      });

      expect(executeResult.success).toBe(false);
      expect(executeResult.error.message).toBe('Synchronous error');
    });

    it('should handle execution with no function provided', async () => {
      const { result } = renderHook(() => useAsyncState());

      let executeResult: any;
      await act(async () => {
        executeResult = await result.current.execute();
      });

      expect(executeResult.success).toBe(false);
      expect(executeResult.error.message).toBe('No async function provided');
    });
  });

  describe('useDebouncedState Edge Cases', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle zero delay', () => {
      const { result } = renderHook(() => useDebouncedState('initial', 0));

      act(() => {
        result.current[2]('updated');
      });

      expect(result.current[0]).toBe('updated');
      expect(result.current[1]).toBe('initial');

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(result.current[1]).toBe('updated');
    });

    it('should handle negative delay', () => {
      const { result } = renderHook(() => useDebouncedState('initial', -100));

      act(() => {
        result.current[2]('updated');
      });

      // Negative delay should be treated as 0
      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(result.current[1]).toBe('updated');
    });

    it('should handle unmount during debounce period', () => {
      const { result, unmount } = renderHook(() => useDebouncedState('initial', 300));

      act(() => {
        result.current[2]('updated');
      });

      expect(result.current[1]).toBe('initial');

      unmount();

      // Should not throw error or cause memory leaks
      act(() => {
        vi.advanceTimersByTime(300);
      });
    });
  });

  describe('useOptimizedWebSocket Edge Cases', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle WebSocket constructor throwing error', () => {
      const originalWebSocket = global.WebSocket;

      (global as any).WebSocket = vi.fn().mockImplementation(() => {
        throw new Error('WebSocket construction failed');
      });

      const { result } = renderHook(() => useOptimizedWebSocket('ws://invalid-url:9999'));

      expect(result.current.status).toBe('error');
      expect(result.current.error?.message).toBe('WebSocket construction failed');

      global.WebSocket = originalWebSocket;
    });

    it('should handle send message with connection in invalid state', async () => {
      const { result } = renderHook(() =>
        useOptimizedWebSocket('ws://localhost:8080', { autoConnect: false }),
      );

      // Try to send message when not connected
      const success = result.current.sendMessage('test', { data: 'should fail' });

      expect(success).toBe(false);
      expect(MockWebSocket.prototype.send).not.toHaveBeenCalled();
    });

    it('should handle malformed JSON parsing errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useOptimizedWebSocket('ws://localhost:8080'));

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      const mockWs = new MockWebSocket();

      // Send invalid JSON
      act(() => {
        if (mockWs.onmessage) {
          mockWs.onmessage(
            new MessageEvent('message', {
              data: '{"invalid": json}',
            }),
          );
        }
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse WebSocket message:',
        expect.any(Error),
      );

      // Should not crash the hook
      expect(result.current.status).not.toBe('error');

      consoleSpy.mockRestore();
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should clean up all references on unmount', () => {
      const cleanupFunctions: Array<() => void> = [];

      const { unmount } = renderHook(() => {
        const state1 = useOptimizedState({ large: new Array(100).fill('data') });
        const state2 = useAsyncState();
        const state3 = useDebouncedState('test', 100);

        // Track cleanup functions
        React.useEffect(() => {
          const cleanup = () => {
            cleanupFunctions.push(() => {});
          };

          return cleanup;
        }, []);

        return { state1, state2, state3 };
      });

      // Unmount should not throw or cause memory leaks
      expect(() => unmount()).not.toThrow();
    });

    it('should handle component unmount during async operations', async () => {
      let resolve: (value: string) => void;
      const longRunningPromise = () =>
        new Promise<string>((r) => {
          resolve = r;
        });

      const { result, unmount } = renderHook(() => useAsyncState(longRunningPromise));

      // Start async operation
      act(() => {
        result.current.execute();
      });

      expect(result.current.loading).toBe(true);

      // Unmount before completion
      unmount();

      // Complete the promise - should not cause errors
      await act(async () => {
        resolve('completed after unmount');
        await Promise.resolve();
      });

      // Should not throw errors
    });
  });
});
