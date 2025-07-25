import { vi } from 'vitest';
import { configure } from '@testing-library/react'
import '@testing-library/jest-dom';

// Enhanced React Testing Library configuration for TDD
configure({
  testIdAttribute: 'data-testid',
  computedStyleSupportsPseudoElements: true,
  asyncUtilTimeout: 2000,
  getElementError: (message, container) => {
    const error = new Error(
      [
        message,
        'Ignored nodes: comments, script, style',
        container.innerHTML,
      ].filter(Boolean).join('\n\n'),
    )
    error.name = 'TestingLibraryElementError'
    return error
  },
})

// Mock browser APIs with enhanced functionality for TDD
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver for responsive testing
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  callback: vi.fn(),
}));

// Mock IntersectionObserver for visibility testing
global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  callback,
  root: null,
  rootMargin: '0px',
  thresholds: [0],
}));

// Mock clipboard API for copy/paste testing
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
    write: vi.fn().mockResolvedValue(undefined),
    read: vi.fn().mockResolvedValue([]),
  },
  writable: true,
});

// Mock geolocation API for location-based components
Object.defineProperty(navigator, 'geolocation', {
  value: {
    getCurrentPosition: vi.fn().mockImplementation((success) => 
      success({
        coords: {
          latitude: 51.1,
          longitude: 45.3,
          accuracy: 100,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      })
    ),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  },
  writable: true,
});

// Mock Web APIs for comprehensive testing
global.URL.createObjectURL = vi.fn(() => 'mocked-url');
global.URL.revokeObjectURL = vi.fn();

// Mock localStorage and sessionStorage
const mockStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockStorage,
  writable: true,
});

Object.defineProperty(window, 'sessionStorage', {
  value: mockStorage,
  writable: true,
});

// Mock window.location for navigation testing
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: '',
    hostname: 'localhost',
    port: '3000',
    protocol: 'http:',
    assign: vi.fn(),
    reload: vi.fn(),
    replace: vi.fn(),
  },
  writable: true,
});

// Mock requestAnimationFrame and cancelAnimationFrame for animation testing
global.requestAnimationFrame = vi.fn(cb => setTimeout(cb, 16));
global.cancelAnimationFrame = vi.fn(id => clearTimeout(id));

// Mock performance API for performance testing
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
  },
  writable: true,
});

// Enhanced error handling for better test diagnostics
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global test utilities available to all tests
declare global {
  namespace Vi {
    interface JestAssertion<T = any> {
      toHaveAccessibleName(name?: string): T;
      toHaveAccessibleDescription(description?: string): T;
      toPassAxeTests(): Promise<T>;
    }
  }
}

// Test environment detection
if (typeof global !== 'undefined') {
  global.IS_REACT_ACT_ENVIRONMENT = true;
}

// Suppress console warnings in tests unless explicitly needed
const originalWarn = console.warn;
const originalError = console.error;

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  
  // Suppress React warnings unless explicitly needed
  console.warn = vi.fn((message) => {
    if (!message.includes('React') && !message.includes('act(')) {
      originalWarn(message);
    }
  });
  
  console.error = vi.fn((message) => {
    if (!message.includes('Warning: ReactDOM.render')) {
      originalError(message);
    }
  });
});

afterEach(() => {
  // Restore console methods
  console.warn = originalWarn;
  console.error = originalError;
});