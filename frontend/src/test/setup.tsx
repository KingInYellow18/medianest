import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import React from 'react';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';

import { server } from './mocks/server';

// Make React and hooks globally available for tests
global.React = React;
const {
  useState,
  useEffect,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useRef,
  useImperativeHandle,
  useLayoutEffect,
  useDebugValue,
} = React;

// Export hooks globally for tests
Object.assign(globalThis, {
  React,
  useState,
  useEffect,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useRef,
  useImperativeHandle,
  useLayoutEffect,
  useDebugValue,
});

// Setup MSW server
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'warn',
  });
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

// Cleanup after all tests
afterAll(() => {
  server.close();
});

// Mock NextAuth.js
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: null,
    status: 'unauthenticated',
  })),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/'),
  useParams: vi.fn(() => ({})),
}));

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} />;
  },
}));

// Mock window.open for Plex auth
Object.defineProperty(window, 'open', {
  writable: true,
  value: vi.fn(),
});

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

// Mock fetch if not available in test environment
global.fetch = global.fetch || vi.fn();

// Mock @medianest/shared package
vi.mock('@medianest/shared', () => ({
  AppError: class AppError extends Error {
    constructor(message: string, public statusCode: number = 500) {
      super(message);
      this.name = 'AppError';
    }
  },
  logError: vi.fn(),
  getUserFriendlyMessage: vi.fn(),
  extractErrorDetails: vi.fn(),
  ServiceUnavailableError: class ServiceUnavailableError extends Error {
    constructor(message: string, public statusCode: number = 503) {
      super(message);
      this.name = 'ServiceUnavailableError';
    }
  },
  isAppError: vi.fn((error: any) => error instanceof Error && error.name === 'AppError'),
}));

// Mock @medianest/shared/config
vi.mock('@medianest/shared/config', () => ({
  FrontendConfigSchema: {
    parse: vi.fn(() => ({
      NODE_ENV: 'test',
      NEXT_PUBLIC_API_URL: 'http://localhost:3000',
      NEXTAUTH_URL: 'http://localhost:3000',
      NEXTAUTH_SECRET: 'test-secret',
      PLEX_CLIENT_ID: 'test-client-id',
      PLEX_CLIENT_SECRET: 'test-client-secret',
    })),
  },
  createConfiguration: vi.fn(() => ({
    NODE_ENV: 'test',
    NEXT_PUBLIC_API_URL: 'http://localhost:3000',
    NEXTAUTH_URL: 'http://localhost:3000',
    NEXTAUTH_SECRET: 'test-secret',
    PLEX_CLIENT_ID: 'test-client-id',
    PLEX_CLIENT_SECRET: 'test-client-secret',
  })),
  environmentLoader: {
    getEnvironment: vi.fn(() => 'test'),
  },
  configUtils: {},
}));

// Suppress console errors in tests unless needed
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});
