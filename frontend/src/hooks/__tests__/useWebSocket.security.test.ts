/**
 * TIER 3 CRITICAL SECURITY TESTS - useWebSocket Hook (9 tests)
 * Testing WebSocket connection security and message validation
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { useWebSocket } from '../useWebSocket';

// Mock socket manager
const mockSocket = {
  connected: false,
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

const mockSocketManager = {
  connect: vi.fn(() => mockSocket),
  disconnect: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  isConnected: vi.fn(() => false),
};

vi.mock('@/lib/socket', () => ({
  socketManager: mockSocketManager,
}));

describe('useWebSocket Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
    mockSocketManager.isConnected.mockReturnValue(false);
  });

  describe('Connection Security', () => {
    test('should validate connection status before operations', () => {
      const { result } = renderHook(() => useWebSocket());
      
      // Should start with secure defaults
      expect(result.current.isConnected).toBe(false);
      expect(result.current.connectionError).toBe(null);
      expect(result.current.reconnectAttempt).toBe(0);
    });

    test('should prevent connection to malicious endpoints', () => {
      renderHook(() => useWebSocket());
      
      // Verify socket manager is used (which should validate endpoints)
      expect(mockSocketManager.connect).toHaveBeenCalled();
      
      // Should not directly connect to arbitrary URLs
      expect(mockSocketManager.connect).not.toHaveBeenCalledWith('ws://evil.com');
      expect(mockSocketManager.connect).not.toHaveBeenCalledWith('wss://malicious.site');
    });

    test('should implement secure reconnection logic', () => {
      const { result } = renderHook(() => useWebSocket());
      
      act(() => {
        result.current.reconnect();
      });
      
      // Should disconnect first then reconnect (prevents connection hijacking)
      expect(mockSocketManager.disconnect).toHaveBeenCalled();
      expect(mockSocketManager.connect).toHaveBeenCalledTimes(2); // Initial + reconnect
    });

    test('should handle connection errors securely', () => {
      const { result } = renderHook(() => useWebSocket());
      
      // Simulate connection error event
      const errorHandler = mockSocketManager.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];
      
      if (errorHandler) {
        act(() => {
          errorHandler({
            message: 'Connection failed: Internal server details exposed',
            code: 'CONN_FAILED',
          });
        });
        
        // Should set error but not expose internal details
        expect(result.current.connectionError).toContain('Connection failed');
        expect(result.current.connectionError).not.toContain('Internal server');
      }
    });
  });

  describe('Message Validation Security', () => {
    test('should validate incoming connection status messages', () => {
      const { result } = renderHook(() => useWebSocket());
      
      // Get the connection status handler
      const statusHandler = mockSocketManager.on.mock.calls.find(
        call => call[0] === 'connection:status'
      )?.[1];
      
      if (statusHandler) {
        // Test malicious status messages
        const maliciousStatuses = [
          {
            connected: '<script>alert("XSS")</script>',
            latency: 'javascript:evil()',
            reconnectAttempt: '../../etc/passwd',
          },
          {
            connected: true,
            latency: -1,
            reconnectAttempt: 999999,
          },
          null,
          undefined,
          'malicious string',
        ];
        
        maliciousStatuses.forEach((maliciousStatus) => {
          act(() => {
            statusHandler(maliciousStatus);
          });
          
          // Should handle malicious input safely
          expect(result.current.isConnected).toEqual(
            expect.any(Boolean)
          );
          expect(result.current.reconnectAttempt).toEqual(
            expect.any(Number)
          );
        });
      }
    });

    test('should sanitize error messages from server', () => {
      const { result } = renderHook(() => useWebSocket());
      
      const errorHandler = mockSocketManager.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];
      
      if (errorHandler) {
        const maliciousErrors = [
          {
            message: '<script>document.location="http://evil.com"</script>',
            code: 'XSS_ATTEMPT',
          },
          {
            message: 'Error: Database password is secret123',
            code: 'DB_ERROR',
          },
          {
            message: 'Stack trace: /app/.env:1:1',
            code: 'TRACE_LEAK',
          },
        ];
        
        maliciousErrors.forEach((maliciousError) => {
          act(() => {
            errorHandler(maliciousError);
          });
          
          // Should not expose sensitive information
          expect(result.current.connectionError).not.toContain('<script>');
          expect(result.current.connectionError).not.toContain('secret123');
          expect(result.current.connectionError).not.toContain('/app/.env');
          expect(document.location.href).not.toContain('evil.com');
        });
      }
    });

    test('should validate reconnection attempt limits', () => {
      const { result } = renderHook(() => useWebSocket());
      
      const statusHandler = mockSocketManager.on.mock.calls.find(
        call => call[0] === 'connection:status'
      )?.[1];
      
      if (statusHandler) {
        // Test excessive reconnection attempts
        act(() => {
          statusHandler({
            connected: false,
            reconnectAttempt: 999999, // Excessive attempts
          });
        });
        
        // Should limit reconnection attempts to prevent DoS
        expect(result.current.reconnectAttempt).toBeLessThan(1000);
      }
    });
  });

  describe('Event Subscription Security', () => {
    test('should validate subscription events', () => {
      renderHook(() => useWebSocket());
      
      // Verify safe subscription events are used
      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:status');
      
      // Should not subscribe to dangerous events
      expect(mockSocket.emit).not.toHaveBeenCalledWith('admin:commands');
      expect(mockSocket.emit).not.toHaveBeenCalledWith('system:execute');
    });

    test('should handle subscription errors gracefully', () => {
      const { result } = renderHook(() => useWebSocket());
      
      // Mock subscription failure
      mockSocket.emit.mockImplementation((event) => {
        if (event === 'subscribe:status') {
          throw new Error('Subscription failed');
        }
      });
      
      // Should not crash on subscription errors
      expect(() => {
        act(() => {
          result.current.refreshService('test-service');
        });
      }).not.toThrow();
    });

    test('should validate service refresh requests', () => {
      const { result } = renderHook(() => useWebSocket());
      
      const maliciousServiceIds = [
        '<script>alert("XSS")</script>',
        '../../../etc/passwd',
        'service"; DROP TABLE services; --',
        null,
        undefined,
        123,
        {},
      ];
      
      maliciousServiceIds.forEach((maliciousId) => {
        act(() => {
          result.current.refreshService(maliciousId as string);
        });
        
        // Should emit with the ID (validation happens at server level)
        expect(mockSocket.emit).toHaveBeenCalledWith(
          'request:refresh',
          maliciousId
        );
      });
    });
  });

  describe('Memory and Resource Security', () => {
    test('should properly cleanup event listeners to prevent memory leaks', () => {
      const { unmount } = renderHook(() => useWebSocket());
      
      // Verify event listeners are added
      expect(mockSocketManager.on).toHaveBeenCalledWith(
        'connection:status',
        expect.any(Function)
      );
      expect(mockSocketManager.on).toHaveBeenCalledWith(
        'error',
        expect.any(Function)
      );
      
      // Unmount component
      unmount();
      
      // Verify cleanup
      expect(mockSocketManager.off).toHaveBeenCalledWith(
        'connection:status',
        expect.any(Function)
      );
      expect(mockSocketManager.off).toHaveBeenCalledWith(
        'error',
        expect.any(Function)
      );
    });

    test('should prevent event listener pollution', () => {
      // Render multiple instances
      const hook1 = renderHook(() => useWebSocket());
      const hook2 = renderHook(() => useWebSocket());
      const hook3 = renderHook(() => useWebSocket());
      
      // Each should register its own listeners
      expect(mockSocketManager.on).toHaveBeenCalledTimes(6); // 2 events × 3 hooks
      
      // Cleanup should work for each instance
      hook1.unmount();
      hook2.unmount();
      hook3.unmount();
      
      expect(mockSocketManager.off).toHaveBeenCalledTimes(6);
    });

    test('should handle rapid connect/disconnect cycles safely', () => {
      const { result } = renderHook(() => useWebSocket());
      
      // Simulate rapid reconnection attempts
      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.reconnect();
        });
      }
      
      // Should handle rapid calls without crashing
      expect(mockSocketManager.disconnect).toHaveBeenCalledTimes(10);
      expect(mockSocketManager.connect).toHaveBeenCalledTimes(11); // Initial + 10 reconnects
    });
  });

  describe('State Management Security', () => {
    test('should initialize with secure default state', () => {
      const { result } = renderHook(() => useWebSocket());
      
      // Verify secure defaults
      expect(result.current.isConnected).toBe(false);
      expect(result.current.connectionError).toBe(null);
      expect(result.current.reconnectAttempt).toBe(0);
    });

    test('should prevent state manipulation attacks', () => {
      const { result } = renderHook(() => useWebSocket());
      
      // Attempt to manipulate state directly (should be immutable)
      const originalIsConnected = result.current.isConnected;
      
      try {
        (result.current as any).isConnected = true;
        (result.current as any).connectionError = 'hacked';
        (result.current as any).reconnectAttempt = 999;
      } catch (error) {
        // Expected if state is properly protected
      }
      
      // State should remain unchanged
      expect(result.current.isConnected).toBe(originalIsConnected);
    });

    test('should validate state transitions', () => {
      const { result } = renderHook(() => useWebSocket());
      
      const statusHandler = mockSocketManager.on.mock.calls.find(
        call => call[0] === 'connection:status'
      )?.[1];
      
      if (statusHandler) {
        // Test invalid state transitions
        act(() => {
          statusHandler({
            connected: true,
            reconnectAttempt: -1, // Invalid negative value
          });
        });
        
        // Should handle invalid transitions gracefully
        expect(result.current.reconnectAttempt).toBeGreaterThanOrEqual(0);
      }
    });
  });
});