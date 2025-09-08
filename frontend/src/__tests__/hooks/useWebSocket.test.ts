import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useWebSocket from '../../hooks/useWebSocket';

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
  id: 'test-socket-id',
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
  });

  it('should initialize socket connection with default config', () => {
    const { result } = renderHook(() => useWebSocket());

    expect(result.current.socket).toBeDefined();
    expect(result.current.connected).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.emit).toBe('function');
    expect(typeof result.current.on).toBe('function');
    expect(typeof result.current.off).toBe('function');
  });

  it('should initialize socket connection with custom config', () => {
    const customConfig = {
      url: 'http://custom-url:3000',
      options: {
        transports: ['websocket'],
        timeout: 5000,
      },
    };

    renderHook(() => useWebSocket(customConfig));

    const { io } = require('socket.io-client');
    expect(io).toHaveBeenCalledWith(customConfig.url, customConfig.options);
  });

  it('should handle socket connection event', () => {
    const { result } = renderHook(() => useWebSocket());

    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));

    // Simulate connection event
    const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')[1];
    act(() => {
      mockSocket.connected = true;
      connectHandler();
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should handle socket disconnect event', () => {
    const { result } = renderHook(() => useWebSocket());

    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));

    // Simulate disconnect event
    const disconnectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'disconnect')[1];
    act(() => {
      mockSocket.connected = false;
      disconnectHandler('io server disconnect');
    });

    expect(result.current.connected).toBe(false);
  });

  it('should handle socket error event', () => {
    const { result } = renderHook(() => useWebSocket());

    expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));

    // Simulate error event
    const errorHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect_error')[1];
    const testError = new Error('Connection failed');

    act(() => {
      errorHandler(testError);
    });

    expect(result.current.error).toBe(testError);
    expect(result.current.connected).toBe(false);
  });

  it('should emit events through socket', () => {
    const { result } = renderHook(() => useWebSocket());

    const eventData = { message: 'test message' };
    act(() => {
      result.current.emit('test-event', eventData);
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('test-event', eventData);
  });

  it('should register event listeners', () => {
    const { result } = renderHook(() => useWebSocket());

    const mockHandler = vi.fn();
    act(() => {
      result.current.on('custom-event', mockHandler);
    });

    expect(mockSocket.on).toHaveBeenCalledWith('custom-event', mockHandler);
  });

  it('should unregister event listeners', () => {
    const { result } = renderHook(() => useWebSocket());

    const mockHandler = vi.fn();
    act(() => {
      result.current.off('custom-event', mockHandler);
    });

    expect(mockSocket.off).toHaveBeenCalledWith('custom-event', mockHandler);
  });

  it('should cleanup listeners on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket());

    unmount();

    // Verify cleanup calls
    expect(mockSocket.off).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('connect_error', expect.any(Function));
  });

  it('should handle reconnection attempts', () => {
    const { result } = renderHook(() => useWebSocket());

    expect(mockSocket.on).toHaveBeenCalledWith('reconnect', expect.any(Function));

    // Simulate reconnection event
    const reconnectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'reconnect')[1];
    act(() => {
      mockSocket.connected = true;
      reconnectHandler(3); // attempt number
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should handle reconnection errors', () => {
    const { result } = renderHook(() => useWebSocket());

    expect(mockSocket.on).toHaveBeenCalledWith('reconnect_error', expect.any(Function));

    // Simulate reconnection error
    const reconnectErrorHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'reconnect_error'
    )[1];
    const reconnectError = new Error('Reconnection failed');

    act(() => {
      reconnectErrorHandler(reconnectError);
    });

    expect(result.current.error).toBe(reconnectError);
  });

  it('should provide socket instance', () => {
    const { result } = renderHook(() => useWebSocket());

    expect(result.current.socket).toBe(mockSocket);
  });

  it('should handle multiple event registrations', () => {
    const { result } = renderHook(() => useWebSocket());

    const handler1 = vi.fn();
    const handler2 = vi.fn();

    act(() => {
      result.current.on('event1', handler1);
      result.current.on('event2', handler2);
    });

    expect(mockSocket.on).toHaveBeenCalledWith('event1', handler1);
    expect(mockSocket.on).toHaveBeenCalledWith('event2', handler2);
  });

  it('should handle socket state updates correctly', () => {
    const { result } = renderHook(() => useWebSocket());

    // Initially disconnected
    expect(result.current.connected).toBe(false);

    // Connect
    const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')[1];
    act(() => {
      mockSocket.connected = true;
      connectHandler();
    });

    expect(result.current.connected).toBe(true);

    // Disconnect
    const disconnectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'disconnect')[1];
    act(() => {
      mockSocket.connected = false;
      disconnectHandler();
    });

    expect(result.current.connected).toBe(false);
  });

  it('should clear error on successful connection', () => {
    const { result } = renderHook(() => useWebSocket());

    // Set error first
    const errorHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect_error')[1];
    act(() => {
      errorHandler(new Error('Connection failed'));
    });

    expect(result.current.error).toBeTruthy();

    // Then connect successfully
    const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')[1];
    act(() => {
      mockSocket.connected = true;
      connectHandler();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.connected).toBe(true);
  });
});
