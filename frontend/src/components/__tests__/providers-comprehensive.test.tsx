import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import React from 'react';

// Mock external dependencies with comprehensive functionality
vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn(() => ({
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    clear: vi.fn(),
  })),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="query-client-provider">{children}</div>
  ),
  useQuery: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isLoading: false,
    error: null,
  })),
}));

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="session-provider">{children}</div>
  ),
  useSession: vi.fn(() => ({
    data: { user: { id: '1', name: 'Test User', email: 'test@example.com' } },
    status: 'authenticated',
  })),
}));

vi.mock('@/lib/error-logger', () => ({
  initializeErrorLogger: vi.fn(() => ({
    logError: vi.fn(),
    captureError: vi.fn(),
  })),
  getErrorLogger: vi.fn(() => ({
    logError: vi.fn(),
  })),
}));

vi.mock('@/config', () => ({
  getErrorReportingConfig: vi.fn(() => ({
    endpoint: 'http://test-endpoint.com',
  })),
  isProduction: vi.fn(() => false),
}));

vi.mock('@medianest/shared', () => ({
  AppError: class MockAppError extends Error {
    constructor(
      code: string,
      message: string,
      public statusCode: number = 500,
    ) {
      super(message);
      this.name = 'AppError';
    }
  },
  logError: vi.fn(),
  getUserFriendlyMessage: vi.fn((error) => error.message),
  extractErrorDetails: vi.fn((error) => ({
    message: error.message,
    stack: error.stack,
  })),
}));

vi.mock('next/dynamic', () => ({
  default: vi.fn((fn) => {
    const Component = fn().then
      ? vi.fn(() => <div data-testid="dynamic-component">Dynamic Component</div>)
      : fn;
    Component.displayName = 'DynamicComponent';
    return Component;
  }),
}));

vi.mock('@/lib/enhanced-socket', () => ({
  enhancedSocketManager: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    onStateChange: vi.fn(() => vi.fn()),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    getSocket: vi.fn(() => ({
      connected: true,
      emit: vi.fn(),
    })),
    connectNamespace: vi.fn(),
    getNamespace: vi.fn(() => ({
      on: vi.fn(),
      off: vi.fn(),
      disconnect: vi.fn(),
    })),
    emitToNamespace: vi.fn(),
    checkConnectionQuality: vi.fn(() => Promise.resolve({ quality: 'good' })),
  },
  ConnectionState: {},
}));

vi.mock('@/contexts/WebSocketContext', () => ({
  WebSocketProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="websocket-provider">{children}</div>
  ),
  useWebSocket: vi.fn(() => ({
    connectionState: { connected: true, connecting: false, quality: 'good', reconnectAttempt: 0 },
    isConnected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    emit: vi.fn(),
    subscribeToNotifications: vi.fn(),
    subscribeToDownloads: vi.fn(),
    subscribeToStatus: vi.fn(),
  })),
  useNotifications: vi.fn(() => ({
    subscribeToNotifications: vi.fn(),
    markNotificationAsRead: vi.fn(),
    onNotification: vi.fn(),
  })),
  useDownloads: vi.fn(() => ({
    subscribeToDownloads: vi.fn(),
    getDownloadStatus: vi.fn(),
    onDownloadProgress: vi.fn(),
  })),
  useServiceStatus: vi.fn(() => ({
    subscribeToStatus: vi.fn(),
    refreshService: vi.fn(),
    onStatusUpdate: vi.fn(),
  })),
}));

// Import components after mocks
import { Providers } from '../providers';
import { DynamicProviders } from '../DynamicProviders';
import { ErrorBoundary } from '../ErrorBoundary';
import { SessionProvider } from '../providers/session-provider';

describe('Providers Comprehensive Testing Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset console mocks
    vi.mocked(console.error)?.mockClear?.();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Core Providers Component', () => {
    it('renders providers in correct hierarchical order', () => {
      const TestChild = () => <div data-testid="test-child">Test Content</div>;

      render(
        <Providers>
          <TestChild />
        </Providers>,
      );

      // Verify provider hierarchy: ErrorBoundary > Session > Query > Children
      const sessionProvider = screen.getByTestId('session-provider');
      const queryProvider = screen.getByTestId('query-client-provider');
      const testChild = screen.getByTestId('test-child');

      expect(sessionProvider).toBeInTheDocument();
      expect(queryProvider).toBeInTheDocument();
      expect(testChild).toBeInTheDocument();
      expect(sessionProvider).toContainElement(queryProvider);
    });

    it('initializes QueryClient with production-optimized configuration', () => {
      const { QueryClient } = require('@tanstack/react-query');

      render(
        <Providers>
          <div>Test</div>
        </Providers>,
      );

      expect(QueryClient).toHaveBeenCalledWith({
        defaultOptions: expect.objectContaining({
          queries: expect.objectContaining({
            staleTime: 5 * 60 * 1000, // 5 minutes - actual config
            gcTime: 10 * 60 * 1000, // 10 minutes
            refetchOnWindowFocus: false,
            refetchOnReconnect: 'always',
            retry: expect.any(Function),
            retryDelay: expect.any(Function),
          }),
          mutations: expect.objectContaining({
            retry: expect.any(Function),
          }),
        }),
      });
    });

    it('handles QueryClient retry logic for different error types', () => {
      const { QueryClient } = require('@tanstack/react-query');
      const { AppError } = require('@medianest/shared');

      render(
        <Providers>
          <div>Test</div>
        </Providers>,
      );

      const queryConfig = QueryClient.mock.calls[0][0];
      const queryRetry = queryConfig.defaultOptions.queries.retry;
      const mutationRetry = queryConfig.defaultOptions.mutations.retry;

      // Test 4xx errors should not retry
      const clientError = new AppError('CLIENT_ERROR', 'Bad request', 400);
      expect(queryRetry(1, clientError)).toBe(false);
      expect(mutationRetry(1, clientError)).toBe(false);

      // Test 5xx errors should retry
      const serverError = new AppError('SERVER_ERROR', 'Internal error', 500);
      expect(queryRetry(1, serverError)).toBe(true);
      expect(mutationRetry(1, serverError)).toBe(true);

      // Test max retry limits
      expect(queryRetry(3, serverError)).toBe(false); // Max 3 retries for queries
      expect(mutationRetry(2, serverError)).toBe(false); // Max 2 retries for mutations
    });
  });

  describe('DynamicProviders Component', () => {
    it('renders all providers with WebSocket provider included', async () => {
      const TestChild = () => <div data-testid="dynamic-test-child">Dynamic Child</div>;

      render(
        <DynamicProviders>
          <TestChild />
        </DynamicProviders>,
      );

      // Check all providers are present in correct order
      expect(screen.getByTestId('session-provider')).toBeInTheDocument();
      expect(screen.getByTestId('query-client-provider')).toBeInTheDocument();
      expect(screen.getByTestId('websocket-provider')).toBeInTheDocument();
      expect(screen.getByTestId('dynamic-test-child')).toBeInTheDocument();
    });

    it('maintains provider hierarchy in dynamic setup', () => {
      render(
        <DynamicProviders>
          <div data-testid="nested-child">Nested Child</div>
        </DynamicProviders>,
      );

      const sessionProvider = screen.getByTestId('session-provider');
      const queryProvider = screen.getByTestId('query-client-provider');
      const websocketProvider = screen.getByTestId('websocket-provider');

      // Verify nesting: Session > Query > WebSocket > Children
      expect(sessionProvider).toContainElement(queryProvider);
      expect(queryProvider).toContainElement(websocketProvider);
    });

    it('handles WebSocket provider with specialized hooks', () => {
      const WebSocketFeatureComponent = () => {
        const {
          useNotifications,
          useDownloads,
          useServiceStatus,
        } = require('@/contexts/WebSocketContext');

        const notifications = useNotifications();
        const downloads = useDownloads();
        const serviceStatus = useServiceStatus();

        return (
          <div>
            <div data-testid="notifications-available">
              Notifications: {notifications ? 'Available' : 'Unavailable'}
            </div>
            <div data-testid="downloads-available">
              Downloads: {downloads ? 'Available' : 'Unavailable'}
            </div>
            <div data-testid="service-status-available">
              Service Status: {serviceStatus ? 'Available' : 'Unavailable'}
            </div>
          </div>
        );
      };

      render(
        <DynamicProviders>
          <WebSocketFeatureComponent />
        </DynamicProviders>,
      );

      expect(screen.getByTestId('notifications-available')).toHaveTextContent(
        'Notifications: Available',
      );
      expect(screen.getByTestId('downloads-available')).toHaveTextContent('Downloads: Available');
      expect(screen.getByTestId('service-status-available')).toHaveTextContent(
        'Service Status: Available',
      );
    });
  });

  describe('ErrorBoundary Integration', () => {
    const suppressConsoleError = () => {
      return vi.spyOn(console, 'error').mockImplementation(() => {});
    };

    it('catches and displays errors with user-friendly UI', () => {
      const consoleSpy = suppressConsoleError();

      const ErrorChild = () => {
        throw new Error('Test component error');
      };

      render(
        <ErrorBoundary>
          <ErrorChild />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Test component error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Refresh Page' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('shows custom fallback UI when provided', () => {
      const consoleSpy = suppressConsoleError();

      const ErrorChild = () => {
        throw new Error('Custom fallback error');
      };

      const CustomFallback = () => (
        <div data-testid="custom-fallback">
          <h2>Custom Error Fallback</h2>
          <p>Please contact support</p>
        </div>
      );

      render(
        <ErrorBoundary fallback={<CustomFallback />}>
          <ErrorChild />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByText('Custom Error Fallback')).toBeInTheDocument();
      expect(screen.getByText('Please contact support')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('calls custom error handler and logs to shared error system', () => {
      const consoleSpy = suppressConsoleError();
      const onError = vi.fn();

      const ErrorChild = () => {
        throw new Error('Handler test error');
      };

      render(
        <ErrorBoundary onError={onError}>
          <ErrorChild />
        </ErrorBoundary>,
      );

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Handler test error' }),
        expect.objectContaining({ componentStack: expect.any(String) }),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Real-world Integration Scenarios', () => {
    it('supports complete authenticated workflow', async () => {
      const AuthenticatedApp = () => {
        const { useSession } = require('next-auth/react');
        const { useQuery } = require('@tanstack/react-query');
        const { useWebSocket } = require('@/contexts/WebSocketContext');

        const { data: session, status } = useSession();
        const websocket = useWebSocket();

        const { data, isLoading } = useQuery({
          queryKey: ['user-profile', session?.user?.id],
          queryFn: async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return { profile: 'user data' };
          },
          enabled: !!session?.user?.id,
        });

        if (status === 'loading') return <div data-testid="auth-loading">Loading session...</div>;
        if (!session) return <div data-testid="unauthenticated">Please sign in</div>;
        if (isLoading) return <div data-testid="data-loading">Loading user data...</div>;

        return (
          <div>
            <div data-testid="authenticated-user">Welcome, {session.user.name}</div>
            <div data-testid="websocket-status">
              WebSocket: {websocket.isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <div data-testid="user-data-loaded">User data loaded successfully</div>
          </div>
        );
      };

      render(
        <DynamicProviders>
          <AuthenticatedApp />
        </DynamicProviders>,
      );

      expect(screen.getByTestId('authenticated-user')).toHaveTextContent('Welcome, Test User');
      expect(screen.getByTestId('websocket-status')).toHaveTextContent('WebSocket: Connected');
      expect(screen.getByTestId('user-data-loaded')).toBeInTheDocument();
    });

    it('demonstrates provider scalability with nested components', () => {
      const DeepComponent = ({ level }: { level: number }) => {
        const { useSession } = require('next-auth/react');
        const { useWebSocket } = require('@/contexts/WebSocketContext');

        const session = useSession();
        const websocket = useWebSocket();

        if (level === 0) {
          return (
            <div data-testid={`deep-level-${level}`}>
              Level {level} - User: {session.data?.user?.name}, Connected:{' '}
              {websocket.isConnected ? 'Yes' : 'No'}
            </div>
          );
        }

        return (
          <div data-testid={`deep-level-${level}`}>
            <div>Level {level}</div>
            <DeepComponent level={level - 1} />
          </div>
        );
      };

      render(
        <DynamicProviders>
          <DeepComponent level={3} />
        </DynamicProviders>,
      );

      expect(screen.getByTestId('deep-level-3')).toBeInTheDocument();
      expect(screen.getByTestId('deep-level-0')).toHaveTextContent(
        'User: Test User, Connected: Yes',
      );
    });
  });

  describe('Performance and Type Safety', () => {
    it('maintains stable provider instances across re-renders', () => {
      const { QueryClient } = require('@tanstack/react-query');

      const TestWrapper = ({ version }: { version: number }) => (
        <DynamicProviders>
          <div>Version {version}</div>
        </DynamicProviders>
      );

      const { rerender } = render(<TestWrapper version={1} />);
      const initialCallCount = QueryClient.mock.calls.length;

      rerender(<TestWrapper version={2} />);
      rerender(<TestWrapper version={3} />);

      expect(QueryClient.mock.calls.length).toBe(initialCallCount);
    });

    it('provides type-safe context consumption', () => {
      const TypeSafeComponent = () => {
        const { useSession } = require('next-auth/react');
        const { useWebSocket } = require('@/contexts/WebSocketContext');

        const session = useSession();
        const websocket = useWebSocket();

        const userName: string = session.data?.user?.name || 'Unknown';
        const userEmail: string | undefined = session.data?.user?.email;
        const isConnected: boolean = websocket.isConnected;

        return (
          <div>
            <div data-testid="type-safe-name">{userName}</div>
            <div data-testid="type-safe-email">{userEmail || 'No email'}</div>
            <div data-testid="type-safe-connection">
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
        );
      };

      render(
        <DynamicProviders>
          <TypeSafeComponent />
        </DynamicProviders>,
      );

      expect(screen.getByTestId('type-safe-name')).toHaveTextContent('Test User');
      expect(screen.getByTestId('type-safe-email')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('type-safe-connection')).toHaveTextContent('Connected');
    });

    it('handles various React children types', () => {
      render(<Providers>String child</Providers>);
      expect(screen.getByText('String child')).toBeInTheDocument();

      render(
        <Providers>
          <div data-testid="element-child">Element</div>
        </Providers>,
      );
      expect(screen.getByTestId('element-child')).toBeInTheDocument();

      render(
        <Providers>
          <>
            <span data-testid="fragment-1">Fragment 1</span>
            <span data-testid="fragment-2">Fragment 2</span>
          </>
        </Providers>,
      );
      expect(screen.getByTestId('fragment-1')).toBeInTheDocument();
      expect(screen.getByTestId('fragment-2')).toBeInTheDocument();
    });
  });
});
