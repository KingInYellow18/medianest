import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Set required environment variables
process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost:4000';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock socket.io-client with proper implementation
vi.mock('socket.io-client', () => {
  const createMockSocket = () => {
    const eventHandlers = new Map<string, Array<(...args: any[]) => void>>();
    let isConnected = true; // Start connected by default

    const mockSocket: any = {
      on: vi.fn((event: string, callback: (...args: any[]) => void) => {
        if (!eventHandlers.has(event)) {
          eventHandlers.set(event, []);
        }
        eventHandlers.get(event)?.push(callback);

        // Auto-trigger connect event after a small delay if not already connected
        if (event === 'connect' && isConnected) {
          setTimeout(() => {
            callback();
          }, 0);
        }

        return mockSocket;
      }),
      off: vi.fn((event: string, callback?: (...args: any[]) => void) => {
        if (eventHandlers.has(event)) {
          if (callback) {
            const handlers = eventHandlers.get(event);
            if (handlers) {
              const index = handlers.indexOf(callback);
              if (index > -1) {
                handlers.splice(index, 1);
              }
            }
          } else {
            // Remove all handlers for the event if no callback specified
            eventHandlers.delete(event);
          }
        }
        return mockSocket;
      }),
      emit: vi.fn((..._args: any[]) => mockSocket),
      close: vi.fn(() => {
        isConnected = false;
        mockSocket.connected = false;
      }),
      disconnect: vi.fn(() => {
        isConnected = false;
        mockSocket.connected = false;
        const disconnectHandlers = eventHandlers.get('disconnect') || [];
        disconnectHandlers.forEach((handler: (...args: any[]) => void) => handler());
      }),
      connect: vi.fn(() => {
        if (!isConnected) {
          isConnected = true;
          mockSocket.connected = true;
          const connectHandlers = eventHandlers.get('connect') || [];
          connectHandlers.forEach((handler: (...args: any[]) => void) => handler());
        }
      }),
      connected: true, // Start connected
      io: {
        on: vi.fn(),
        opts: {},
      },
      // Helper method for tests to trigger events
      _trigger: (event: string, ...args: any[]) => {
        const handlers = eventHandlers.get(event) || [];
        handlers.forEach((handler: (...args: any[]) => void) => handler(...args));
      },
      // Helper to get all registered handlers for testing
      _getHandlers: (event: string) => {
        return eventHandlers.get(event) || [];
      },
      _mockConnectionOptions: undefined,
    };

    return mockSocket;
  };

  const io = vi.fn((_url: string, options?: any) => {
    const socket = createMockSocket();
    // Store options for assertion
    socket._mockConnectionOptions = options;
    return socket;
  });

  // Make io function available as both default and named export
  return {
    io,
    default: io,
    Socket: vi.fn(),
  };
});

// Mock fetch for relative URLs
function setupFetchMock() {
  const mockFetch = vi.fn(
    (url: string | URL | Request, _options?: RequestInit): Promise<Response> => {
      const fullUrl =
        typeof url === 'string' && url.startsWith('http')
          ? url
          : `${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`;

      // Return mock response based on URL
      if (fullUrl.includes('/api/services/status')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: 'plex',
                name: 'Plex',
                displayName: 'Plex Media Server',
                status: 'up',
                uptime: {
                  '24h': 99.9,
                  '7d': 99.5,
                  '30d': 99.2,
                },
                responseTime: 45,
                lastCheckAt: new Date().toISOString(),
              },
            ]),
        } as Response);
      }

      return Promise.reject(new Error(`Unmocked fetch: ${fullUrl}`));
    }
  );

  // Type-safe global fetch assignment
  if (typeof global !== 'undefined' && global) {
    (global as any).fetch = mockFetch;
  }
}

// Setup the fetch mock immediately
setupFetchMock();

// Reset global state before each test with type safety
if (typeof globalThis !== 'undefined' && globalThis) {
  Object.defineProperty(globalThis, 'resetBeforeEachTest', {
    value: true,
    writable: true,
    enumerable: false,
    configurable: true
  });
}
