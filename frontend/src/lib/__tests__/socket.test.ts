import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { io } from 'socket.io-client';
import Cookies from 'js-cookie';
import { socketManager } from '../socket';

// Mock socket.io-client
vi.mock('socket.io-client');
vi.mock('js-cookie');

describe('SocketManager', () => {
  let mockSocket: any;
  let mockOn: any;
  let mockEmit: any;
  let mockOff: any;

  beforeEach(() => {
    // Reset the singleton instance
    // @ts-ignore - accessing private property for testing
    socketManager.socket = null;
    // @ts-ignore
    socketManager.listeners.clear();
    // @ts-ignore
    socketManager.reconnectAttempt = 0;

    // Mock socket methods
    mockOn = vi.fn();
    mockEmit = vi.fn();
    mockOff = vi.fn();

    mockSocket = {
      connected: false,
      on: mockOn,
      emit: mockEmit,
      off: mockOff,
      removeAllListeners: vi.fn(),
      disconnect: vi.fn(),
      io: {
        on: vi.fn()
      }
    };

    // Mock io function to return mock socket
    vi.mocked(io).mockReturnValue(mockSocket as any);
    
    // Mock Cookies
    vi.mocked(Cookies.get).mockReturnValue('test-token');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Connection', () => {
    it('should create socket connection with auth token', () => {
      socketManager.connect();

      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          auth: { token: 'test-token' },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
          timeout: 10000
        })
      );
    });

    it('should reuse existing connection if already connected', () => {
      mockSocket.connected = true;
      socketManager.connect();
      const firstSocket = socketManager.getSocket();

      // Try to connect again
      socketManager.connect();
      const secondSocket = socketManager.getSocket();

      expect(firstSocket).toBe(secondSocket);
      expect(io).toHaveBeenCalledTimes(1);
    });

    it('should handle missing auth token', () => {
      vi.mocked(Cookies.get).mockReturnValue(undefined);
      
      socketManager.connect();

      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          auth: { token: undefined }
        })
      );
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      socketManager.connect();
    });

    it('should register event listeners', () => {
      const callback = vi.fn();
      socketManager.on('service:status', callback);

      expect(mockSocket.on).toHaveBeenCalledWith('service:status', callback);
    });

    it('should remove event listeners', () => {
      const callback = vi.fn();
      socketManager.on('service:status', callback);
      socketManager.off('service:status', callback);

      expect(mockSocket.off).toHaveBeenCalledWith('service:status', callback);
    });

    it('should emit events when connected', () => {
      mockSocket.connected = true;
      socketManager.emit('subscribe:status');

      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:status');
    });

    it('should not emit events when disconnected', () => {
      mockSocket.connected = false;
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      socketManager.emit('subscribe:status');

      expect(mockSocket.emit).not.toHaveBeenCalled();
      expect(consoleWarn).toHaveBeenCalledWith(
        "[Socket] Cannot emit 'subscribe:status' - not connected"
      );

      consoleWarn.mockRestore();
    });

    it('should handle local event listeners', () => {
      const callback = vi.fn();
      socketManager.on('connection:status', callback);

      // Emit event locally
      socketManager.emit('connection:status', { connected: true });

      expect(callback).toHaveBeenCalledWith({ connected: true });
    });
  });

  describe('Connection Events', () => {
    beforeEach(() => {
      socketManager.connect();
    });

    it('should handle connect event', () => {
      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];

      // Trigger connect event
      connectHandler?.();

      // Should emit connection status
      const localCallback = vi.fn();
      socketManager.on('connection:status', localCallback);
      connectHandler?.();

      expect(localCallback).toHaveBeenCalledWith({ connected: true });
    });

    it('should handle disconnect event', () => {
      const disconnectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];

      // Trigger disconnect event
      const localCallback = vi.fn();
      socketManager.on('connection:status', localCallback);
      disconnectHandler?.('transport close');

      expect(localCallback).toHaveBeenCalledWith({ connected: false });
    });

    it('should handle connection error', () => {
      const errorHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect_error'
      )?.[1];

      const errorCallback = vi.fn();
      socketManager.on('error', errorCallback);

      // Trigger error
      errorHandler?.({ message: 'Connection failed', type: 'TransportError' });

      expect(errorCallback).toHaveBeenCalledWith({
        message: 'Connection failed',
        code: 'TransportError'
      });
    });
  });

  describe('Reconnection', () => {
    beforeEach(() => {
      socketManager.connect();
    });

    it('should track reconnection attempts', () => {
      const reconnectHandler = mockSocket.io.on.mock.calls.find(
        call => call[0] === 'reconnect_attempt'
      )?.[1];

      reconnectHandler?.(3);

      // @ts-ignore
      expect(socketManager.reconnectAttempt).toBe(3);
    });

    it('should reset reconnect attempt on successful reconnection', () => {
      // Set initial attempt count
      // @ts-ignore
      socketManager.reconnectAttempt = 5;

      const reconnectHandler = mockSocket.io.on.mock.calls.find(
        call => call[0] === 'reconnect'
      )?.[1];

      reconnectHandler?.(5);

      // @ts-ignore
      expect(socketManager.reconnectAttempt).toBe(0);
    });

    it('should emit error on reconnection failure', () => {
      const failHandler = mockSocket.io.on.mock.calls.find(
        call => call[0] === 'reconnect_failed'
      )?.[1];

      const errorCallback = vi.fn();
      socketManager.on('error', errorCallback);

      failHandler?.();

      expect(errorCallback).toHaveBeenCalledWith({
        message: 'Failed to reconnect after maximum attempts',
        code: 'RECONNECT_FAILED'
      });
    });
  });

  describe('Disconnection', () => {
    it('should clean up on disconnect', () => {
      socketManager.connect();
      socketManager.disconnect();

      expect(mockSocket.removeAllListeners).toHaveBeenCalled();
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(socketManager.getSocket()).toBeNull();
      expect(socketManager.isConnected()).toBe(false);
    });
  });

  describe('Connection Options', () => {
    it('should update connection options', () => {
      socketManager.updateConnectionOptions({
        reconnectionDelay: 2000,
        reconnectionAttempts: 10
      });

      socketManager.connect();

      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          reconnectionDelay: 2000,
          reconnectionAttempts: 10
        })
      );
    });

    it('should reconnect with new options if already connected', () => {
      socketManager.connect();
      const firstCallCount = vi.mocked(io).mock.calls.length;

      socketManager.updateConnectionOptions({
        timeout: 20000
      });

      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(vi.mocked(io).mock.calls.length).toBe(firstCallCount + 1);
    });
  });
});