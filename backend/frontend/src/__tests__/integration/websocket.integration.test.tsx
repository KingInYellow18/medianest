/**
 * WebSocket Integration Tests
 * Tests real-time WebSocket connections, message handling, reconnection logic, and error scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { renderWithAuth, IntegrationProvider } from '../../test-utils/integration-render';
import { mswUtils } from '../../test-utils/msw-server';
import { useOptimizedWebSocket, useTypedWebSocketMessage } from '../../hooks/useOptimizedWebSocket';
import React from 'react';

// Mock WebSocket for testing
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  
  private listeners = new Map<string, Set<(event: any) => void>>();
  private messageQueue: any[] = [];

  constructor(url: string) {
    this.url = url;
    
    // Simulate connection delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
      this.dispatchEvent(new Event('open'));
      
      // Send queued messages
      this.messageQueue.forEach(message => {
        if (this.onmessage) {
          this.onmessage(new MessageEvent('message', { data: JSON.stringify(message) }));
        }
      });
      this.messageQueue = [];
    }, 100);
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    
    // Echo back the message for testing
    setTimeout(() => {
      const message = {
        type: 'echo',
        payload: JSON.parse(data),
        timestamp: Date.now(),
      };
      
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', { data: JSON.stringify(message) }));
      }
    }, 50);
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        this.onclose(new CloseEvent('close', { code, reason }));
      }
      this.dispatchEvent(new CloseEvent('close', { code, reason }));
    }, 50);
  }

  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: Event) {
    this.listeners.get(event.type)?.forEach(listener => listener(event));
    return true;
  }

  // Test helpers
  simulateMessage(message: any) {
    if (this.readyState === MockWebSocket.OPEN) {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', { data: JSON.stringify(message) }));
      }
    } else {
      this.messageQueue.push(message);
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
    this.dispatchEvent(new Event('error'));
  }

  simulateClose(code = 1000, reason = 'Normal closure') {
    this.close(code, reason);
  }
}

// Store original WebSocket to restore later
const OriginalWebSocket = global.WebSocket;

// Test components using WebSocket
const WebSocketTestComponent = ({ url = 'ws://localhost:3000/ws' }: { url?: string }) => {
  const webSocket = useOptimizedWebSocket(url);
  const [messages, setMessages] = React.useState<any[]>([]);
  const [connectionHistory, setConnectionHistory] = React.useState<string[]>([]);

  React.useEffect(() => {
    setConnectionHistory(prev => [...prev, webSocket.status]);
  }, [webSocket.status]);

  React.useEffect(() => {
    const cleanup = webSocket.addMessageListener('*', (message) => {
      setMessages(prev => [...prev, message]);
    });

    return cleanup;
  }, [webSocket]);

  const sendTestMessage = () => {
    webSocket.sendMessage('test', { content: 'Hello WebSocket!' });
  };

  const sendPing = () => {
    webSocket.sendMessage('ping', { timestamp: Date.now() });
  };

  return (
    <div>
      <div data-testid="ws-status">{webSocket.status}</div>
      <div data-testid="ws-connected">{webSocket.isConnected ? 'yes' : 'no'}</div>
      <div data-testid="ws-connecting">{webSocket.isConnecting ? 'yes' : 'no'}</div>
      <div data-testid="ws-error">{webSocket.error?.message || 'no-error'}</div>
      <div data-testid="ws-connection-id">{webSocket.connectionId || 'no-id'}</div>
      <div data-testid="ws-message-count">{webSocket.messageCount}</div>
      <div data-testid="ws-reconnect-attempts">{webSocket.reconnectAttempts}</div>
      <div data-testid="ws-max-reconnect-attempts">{webSocket.maxReconnectAttempts}</div>
      
      <button onClick={webSocket.connect} data-testid="ws-connect">
        Connect
      </button>
      <button onClick={webSocket.disconnect} data-testid="ws-disconnect">
        Disconnect
      </button>
      <button onClick={sendTestMessage} data-testid="ws-send-message">
        Send Test Message
      </button>
      <button onClick={sendPing} data-testid="ws-send-ping">
        Send Ping
      </button>
      
      <div data-testid="message-list">
        {messages.map((message, index) => (
          <div key={message.id || index} data-testid={`message-${index}`}>
            <span data-testid={`message-type-${index}`}>{message.type}</span>
            <span data-testid={`message-payload-${index}`}>
              {JSON.stringify(message.payload)}
            </span>
          </div>
        ))}
      </div>
      
      <div data-testid="connection-history">
        {connectionHistory.map((status, index) => (
          <span key={index} data-testid={`history-${index}`}>{status}</span>
        ))}
      </div>
    </div>
  );
};

const TypedWebSocketTestComponent = () => {
  const webSocket = useOptimizedWebSocket('ws://localhost:3000/ws');
  const serviceUpdates = useTypedWebSocketMessage(webSocket, 'service-update');
  const notifications = useTypedWebSocketMessage(webSocket, 'notification');
  
  return (
    <div>
      <div data-testid="service-updates-count">
        {serviceUpdates.messages.length}
      </div>
      <div data-testid="notifications-count">
        {notifications.messages.length}
      </div>
      <div data-testid="latest-service-update">
        {serviceUpdates.latestMessage?.payload?.serviceId || 'none'}
      </div>
      <div data-testid="latest-notification">
        {notifications.latestMessage?.payload?.message || 'none'}
      </div>
      
      <button 
        onClick={() => serviceUpdates.sendTypedMessage({ serviceId: 'test', status: 'updated' })}
        data-testid="send-service-update"
      >
        Send Service Update
      </button>
      <button 
        onClick={() => notifications.sendTypedMessage({ message: 'Test notification' })}
        data-testid="send-notification"
      >
        Send Notification
      </button>
    </div>
  );
};

const ReconnectionTestComponent = () => {
  const webSocket = useOptimizedWebSocket('ws://localhost:3000/ws', {
    maxReconnectAttempts: 3,
    reconnectInterval: 1000,
  });
  
  const [reconnectionEvents, setReconnectionEvents] = React.useState<string[]>([]);
  
  React.useEffect(() => {
    if (webSocket.status === 'disconnected' && webSocket.reconnectAttempts > 0) {
      setReconnectionEvents(prev => [...prev, `attempt-${webSocket.reconnectAttempts}`]);
    }
  }, [webSocket.status, webSocket.reconnectAttempts]);
  
  return (
    <div>
      <div data-testid="reconnect-status">{webSocket.status}</div>
      <div data-testid="reconnect-attempts">{webSocket.reconnectAttempts}</div>
      <div data-testid="reconnect-events">
        {reconnectionEvents.map((event, index) => (
          <span key={index} data-testid={`reconnect-event-${index}`}>{event}</span>
        ))}
      </div>
      
      <button onClick={() => {
        // Simulate connection drop
        if (webSocket.status === 'connected') {
          (global.WebSocket as any).mockInstance?.simulateClose(1006, 'Connection dropped');
        }
      }} data-testid="simulate-disconnect">
        Simulate Disconnect
      </button>
    </div>
  );
};

describe('WebSocket Integration Tests', () => {
  beforeEach(() => {
    mswUtils.resetMockState();
    
    // Mock WebSocket with enhanced functionality
    const mockWebSocketClass = vi.fn().mockImplementation((url: string) => {
      const instance = new MockWebSocket(url);
      (mockWebSocketClass as any).mockInstance = instance;
      return instance;
    });
    
    // Add static constants
    mockWebSocketClass.CONNECTING = MockWebSocket.CONNECTING;
    mockWebSocketClass.OPEN = MockWebSocket.OPEN;
    mockWebSocketClass.CLOSING = MockWebSocket.CLOSING;
    mockWebSocketClass.CLOSED = MockWebSocket.CLOSED;
    
    global.WebSocket = mockWebSocketClass as any;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.WebSocket = OriginalWebSocket;
  });

  describe('WebSocket Connection Management', () => {
    it('should establish WebSocket connection automatically', async () => {
      renderWithAuth(<WebSocketTestComponent />);

      // Initially connecting
      expect(screen.getByTestId('ws-status')).toHaveTextContent('connecting');
      expect(screen.getByTestId('ws-connecting')).toHaveTextContent('yes');
      expect(screen.getByTestId('ws-connected')).toHaveTextContent('no');

      // Advance timers to complete connection
      act(() => {
        vi.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(screen.getByTestId('ws-status')).toHaveTextContent('connected');
      });

      expect(screen.getByTestId('ws-connected')).toHaveTextContent('yes');
      expect(screen.getByTestId('ws-connecting')).toHaveTextContent('no');
      expect(screen.getByTestId('ws-connection-id')).not.toHaveTextContent('no-id');
    });

    it('should handle manual connection and disconnection', async () => {
      const { user } = renderWithAuth(
        <WebSocketTestComponent url="ws://manual-test" />
      );

      // Wait for auto-connection
      act(() => {
        vi.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(screen.getByTestId('ws-status')).toHaveTextContent('connected');
      });

      // Disconnect
      await user.click(screen.getByTestId('ws-disconnect'));

      act(() => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(screen.getByTestId('ws-status')).toHaveTextContent('disconnected');
      });

      expect(screen.getByTestId('ws-connected')).toHaveTextContent('no');

      // Reconnect
      await user.click(screen.getByTestId('ws-connect'));

      act(() => {
        vi.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(screen.getByTestId('ws-status')).toHaveTextContent('connected');
      });
    });

    it('should track connection state history', async () => {
      renderWithAuth(<WebSocketTestComponent />);

      // Wait for connection states
      act(() => {
        vi.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(screen.getByTestId('ws-status')).toHaveTextContent('connected');
      });

      // Check connection history
      expect(screen.getByTestId('history-0')).toHaveTextContent('idle');
      expect(screen.getByTestId('history-1')).toHaveTextContent('connecting');
      expect(screen.getByTestId('history-2')).toHaveTextContent('connected');
    });
  });

  describe('Message Handling', () => {
    it('should send and receive messages', async () => {
      const { user } = renderWithAuth(<WebSocketTestComponent />);

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(screen.getByTestId('ws-connected')).toHaveTextContent('yes');
      });

      // Send test message
      await user.click(screen.getByTestId('ws-send-message'));

      // Wait for echo response
      act(() => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(screen.getByTestId('ws-message-count')).toHaveTextContent('1');
      });

      // Check message details
      expect(screen.getByTestId('message-type-0')).toHaveTextContent('echo');
      expect(screen.getByTestId('message-payload-0')).toHaveTextContent(
        JSON.stringify({ type: 'test', payload: { content: 'Hello WebSocket!' } })
      );
    });

    it('should handle multiple message types', async () => {
      const { user } = renderWithAuth(<WebSocketTestComponent />);

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(screen.getByTestId('ws-connected')).toHaveTextContent('yes');
      });

      // Send different types of messages
      await user.click(screen.getByTestId('ws-send-message'));
      await user.click(screen.getByTestId('ws-send-ping'));

      // Wait for responses
      act(() => {
        vi.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(screen.getByTestId('ws-message-count')).toHaveTextContent('2');
      });

      // Check both messages received
      expect(screen.getByTestId('message-0')).toBeInTheDocument();
      expect(screen.getByTestId('message-1')).toBeInTheDocument();
    });

    it('should handle incoming server messages', async () => {
      renderWithAuth(<WebSocketTestComponent />);

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(screen.getByTestId('ws-connected')).toHaveTextContent('yes');
      });

      // Simulate server message
      const mockWs = (global.WebSocket as any).mockInstance;
      act(() => {
        mockWs.simulateMessage({
          type: 'server-notification',
          payload: { message: 'Server notification' },
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('ws-message-count')).toHaveTextContent('1');
      });

      expect(screen.getByTestId('message-type-0')).toHaveTextContent('server-notification');
    });
  });

  describe('Typed Message Handling', () => {
    it('should handle typed WebSocket messages', async () => {
      const { user } = renderWithAuth(<TypedWebSocketTestComponent />);

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Send typed messages
      await user.click(screen.getByTestId('send-service-update'));
      await user.click(screen.getByTestId('send-notification'));

      // Wait for responses
      act(() => {
        vi.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(screen.getByTestId('service-updates-count')).toHaveTextContent('1');
        expect(screen.getByTestId('notifications-count')).toHaveTextContent('1');
      });
    });

    it('should track latest messages by type', async () => {
      renderWithAuth(<TypedWebSocketTestComponent />);

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Simulate incoming typed messages
      const mockWs = (global.WebSocket as any).mockInstance;
      
      act(() => {
        mockWs.simulateMessage({
          type: 'service-update',
          payload: { serviceId: 'service-1', status: 'connected' },
          timestamp: Date.now(),
        });
      });

      act(() => {
        mockWs.simulateMessage({
          type: 'notification',
          payload: { message: 'System notification' },
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('latest-service-update')).toHaveTextContent('service-1');
        expect(screen.getByTestId('latest-notification')).toHaveTextContent('System notification');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket connection errors', async () => {
      renderWithAuth(<WebSocketTestComponent />);

      // Simulate connection error before success
      const mockWs = (global.WebSocket as any).mockInstance;
      act(() => {
        mockWs.simulateError();
      });

      await waitFor(() => {
        expect(screen.getByTestId('ws-status')).toHaveTextContent('error');
      });

      expect(screen.getByTestId('ws-connected')).toHaveTextContent('no');
      expect(screen.getByTestId('ws-error')).not.toHaveTextContent('no-error');
    });

    it('should handle message send failures when disconnected', async () => {
      const { user } = renderWithAuth(<WebSocketTestComponent />);

      // Don't wait for connection, try to send message immediately
      const sendResult = await user.click(screen.getByTestId('ws-send-message'));

      // Message should fail silently (no error thrown)
      expect(screen.getByTestId('ws-message-count')).toHaveTextContent('0');
    });

    it('should handle malformed incoming messages', async () => {
      renderWithAuth(<WebSocketTestComponent />);

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(screen.getByTestId('ws-connected')).toHaveTextContent('yes');
      });

      // Simulate malformed message
      const mockWs = (global.WebSocket as any).mockInstance;
      act(() => {
        if (mockWs.onmessage) {
          mockWs.onmessage(new MessageEvent('message', { data: 'invalid-json' }));
        }
      });

      // Should handle gracefully without crashing
      expect(screen.getByTestId('ws-connected')).toHaveTextContent('yes');
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt reconnection after connection loss', async () => {
      renderWithAuth(<ReconnectionTestComponent />);

      // Wait for initial connection
      act(() => {
        vi.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(screen.getByTestId('reconnect-status')).toHaveTextContent('connected');
      });

      // Simulate connection drop
      const mockWs = (global.WebSocket as any).mockInstance;
      act(() => {
        mockWs.simulateClose(1006, 'Connection dropped');
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(screen.getByTestId('reconnect-status')).toHaveTextContent('disconnected');
      });

      // Wait for reconnection attempt
      act(() => {
        vi.advanceTimersByTime(1100); // Reconnect interval + connection time
      });

      await waitFor(() => {
        expect(screen.getByTestId('reconnect-attempts')).toHaveTextContent('1');
      });
    });

    it('should stop reconnecting after max attempts', async () => {
      renderWithAuth(<ReconnectionTestComponent />);

      // Wait for initial connection
      act(() => {
        vi.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(screen.getByTestId('reconnect-status')).toHaveTextContent('connected');
      });

      // Simulate repeated connection failures
      for (let i = 0; i < 4; i++) {
        const mockWs = (global.WebSocket as any).mockInstance;
        act(() => {
          mockWs.simulateClose(1006, 'Connection dropped');
        });

        act(() => {
          vi.advanceTimersByTime(1200);
        });
      }

      await waitFor(() => {
        expect(screen.getByTestId('reconnect-attempts')).toHaveTextContent('3');
      });

      // Should stop attempting after max attempts
      expect(screen.getByTestId('reconnect-status')).toHaveTextContent('disconnected');
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle message history buffer limits', async () => {
      renderWithAuth(<WebSocketTestComponent />);

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(screen.getByTestId('ws-connected')).toHaveTextContent('yes');
      });

      // Send many messages to test buffer limits
      const mockWs = (global.WebSocket as any).mockInstance;
      for (let i = 0; i < 150; i++) {
        act(() => {
          mockWs.simulateMessage({
            type: 'test-message',
            payload: { index: i },
            timestamp: Date.now(),
          });
        });
      }

      await waitFor(() => {
        // Should not exceed buffer size (default 100)
        const messageCount = parseInt(screen.getByTestId('ws-message-count').textContent || '0');
        expect(messageCount).toBeLessThanOrEqual(100);
      });
    });

    it('should cleanup resources on unmount', () => {
      const { unmount } = renderWithAuth(<WebSocketTestComponent />);

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Unmount component
      unmount();

      // WebSocket should be closed
      const mockWs = (global.WebSocket as any).mockInstance;
      expect(mockWs?.readyState).toBe(MockWebSocket.CLOSED);
    });
  });

  describe('Hook Usage Patterns', () => {
    it('should work correctly when used directly with renderHook', async () => {
      const { result } = renderHook(() => useOptimizedWebSocket('ws://test'), {
        wrapper: ({ children }) => (
          <IntegrationProvider mockAuthentication={true}>
            {children}
          </IntegrationProvider>
        ),
      });

      expect(result.current.status).toBe('connecting');

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(result.current.status).toBe('connected');
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.connectionId).toBeTruthy();
    });

    it('should handle multiple hook instances with different URLs', async () => {
      const MultipleWebSocketComponent = () => {
        const ws1 = useOptimizedWebSocket('ws://server1');
        const ws2 = useOptimizedWebSocket('ws://server2');

        return (
          <div>
            <div data-testid="ws1-status">{ws1.status}</div>
            <div data-testid="ws2-status">{ws2.status}</div>
            <div data-testid="ws1-id">{ws1.connectionId || 'no-id'}</div>
            <div data-testid="ws2-id">{ws2.connectionId || 'no-id'}</div>
          </div>
        );
      };

      renderWithAuth(<MultipleWebSocketComponent />);

      // Wait for both connections
      act(() => {
        vi.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(screen.getByTestId('ws1-status')).toHaveTextContent('connected');
        expect(screen.getByTestId('ws2-status')).toHaveTextContent('connected');
      });

      // Should have different connection IDs
      const ws1Id = screen.getByTestId('ws1-id').textContent;
      const ws2Id = screen.getByTestId('ws2-id').textContent;
      expect(ws1Id).not.toBe(ws2Id);
      expect(ws1Id).not.toBe('no-id');
      expect(ws2Id).not.toBe('no-id');
    });
  });
});