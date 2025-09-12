/**
 * Enhanced test setup for MediaNest frontend integration tests
 * Configures MSW server, test providers, and integration test utilities
 */

import { cleanup } from '@testing-library/react';
import { beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import '@testing-library/jest-dom';
import { mswServer, mswUtils } from './msw-server';

// Start MSW server before all tests
beforeAll(() => {
  mswServer.listen({
    onUnhandledRequest: 'warn', // Warn about unhandled requests in tests
  });
});

// Reset handlers and mock state before each test
beforeEach(() => {
  mswServer.resetHandlers();
  mswUtils.resetMockState();
  
  // Mock console methods to reduce noise in integration tests
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  
  // Setup fake timers for more predictable async behavior (only for specific tests)
  // vi.useFakeTimers(); // Commented out as it's causing timeouts in integration tests
  
  // Mock window.fetch if needed (MSW should handle most cases)
  global.fetch = vi.fn();
  
  // Mock localStorage and sessionStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  });
  Object.defineProperty(window, 'sessionStorage', {
    value: localStorageMock,
  });
  
  // Mock window.location
  delete (window as any).location;
  window.location = {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    pathname: '/',
    search: '',
    hash: '',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  } as any;
  
  // Mock WebSocket for real-time features
  Object.defineProperty(global, 'WebSocket', {
    writable: true,
    value: vi.fn().mockImplementation((url: string) => ({
      url,
      readyState: 0, // CONNECTING
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    }))
  });
  
  // Mock IntersectionObserver for components that might use it
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
  
  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
  
  // Mock matchMedia for responsive design tests
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
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
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  // vi.runOnlyPendingTimers();
  // vi.useRealTimers();
});

// Stop MSW server after all tests
afterAll(() => {
  mswServer.close();
});

// Global test utilities
declare global {
  var __TEST_ENV__: true;
  var __MSW_SERVER__: typeof mswServer;
  var __MSW_UTILS__: typeof mswUtils;
}

globalThis.__TEST_ENV__ = true;
globalThis.__MSW_SERVER__ = mswServer;
globalThis.__MSW_UTILS__ = mswUtils;

// Test environment variables
process.env.NODE_ENV = 'test';
process.env.VITE_API_URL = 'http://localhost:3000/api';
process.env.VITE_WS_URL = 'ws://localhost:3000/ws';