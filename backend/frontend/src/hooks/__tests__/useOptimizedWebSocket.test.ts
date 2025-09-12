import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';

import { useOptimizedWebSocket, useTypedWebSocketMessage } from '../useOptimizedWebSocket';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  protocols: string[];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string, protocols: string[] = []) {
    this.url = url;
    this.protocols = protocols;

    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  send = vi.fn((data: string) => {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  });

  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.onclose?.(new CloseEvent('close'));
    }, 10);
  });

  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(
        new MessageEvent('message', {
          data: JSON.stringify(data),
        }),
      );
    }
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }
}

// Replace global WebSocket with mock
const originalWebSocket = global.WebSocket;
beforeAll(() => {
  (global as any).WebSocket = MockWebSocket;
});

afterAll(() => {
  global.WebSocket = originalWebSocket;
});

describe('useOptimizedWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should initialize with idle status when autoConnect is false', () => {
      const { result } = renderHook(() =>
        useOptimizedWebSocket('ws://localhost:8080', { autoConnect: false }),
      );

      expect(result.current.status).toBe('idle');
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.connectionId).toBeNull();
    });

    it('should auto-connect by default', async () => {
      const { result } = renderHook(() => useOptimizedWebSocket('ws://localhost:8080'));

      expect(result.current.status).toBe('connecting');
      expect(result.current.isConnecting).toBe(true);

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      expect(result.current.status).toBe('connected');
      expect(result.current.isConnected).toBe(true);
      expect(result.current.connectionId).toBeTruthy();
    });

    it('should connect manually when autoConnect is false', async () => {
      const { result } = renderHook(() =>
        useOptimizedWebSocket('ws://localhost:8080', { autoConnect: false }),
      );

      act(() => {
        result.current.connect();
      });

      expect(result.current.status).toBe('connecting');

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      expect(result.current.status).toBe('connected');
      expect(result.current.isConnected).toBe(true);
    });

    it('should send messages when connected', async () => {
      const { result } = renderHook(() => useOptimizedWebSocket('ws://localhost:8080'));

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      const success = result.current.sendMessage('test', { data: 'hello' });

      expect(success).toBe(true);
      expect(MockWebSocket.prototype.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'test',
          payload: { data: 'hello' },
          timestamp: expect.any(Number),
          id: result.current.connectionId,
        }),
      );
    });

    it('should not send messages when disconnected', () => {
      const { result } = renderHook(() =>
        useOptimizedWebSocket('ws://localhost:8080', { autoConnect: false }),
      );

      const success = result.current.sendMessage('test', { data: 'hello' });

      expect(success).toBe(false);
      expect(MockWebSocket.prototype.send).not.toHaveBeenCalled();
    });
  });
});

describe('useTypedWebSocketMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Message Filtering', () => {
    it('should filter messages by type', async () => {
      const mockWebSocket = {
        addMessageListener: vi.fn((type, handler) => {
          return () => {};
        }),
        sendMessage: vi.fn(() => true),
      } as any;

      const { result } = renderHook(() => useTypedWebSocketMessage(mockWebSocket, 'chat'));

      expect(mockWebSocket.addMessageListener).toHaveBeenCalledWith('chat', expect.any(Function));

      expect(result.current.messages).toHaveLength(0);
      expect(result.current.latestMessage).toBeNull();
    });

    it('should send typed messages', () => {
      const mockWebSocket = {
        addMessageListener: vi.fn(() => () => {}),
        sendMessage: vi.fn(() => true),
      } as any;

      const { result } = renderHook(() => useTypedWebSocketMessage(mockWebSocket, 'command'));

      const payload = { action: 'start', data: { id: 123 } };
      const success = result.current.sendTypedMessage(payload);

      expect(success).toBe(true);
      expect(mockWebSocket.sendMessage).toHaveBeenCalledWith('command', payload);
    });
  });
});
