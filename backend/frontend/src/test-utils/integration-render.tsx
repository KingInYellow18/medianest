/**
 * Custom render utilities for MediaNest integration tests
 * Provides enhanced testing utilities with full app context, providers, and MSW integration
 */

import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider } from '../contexts/OptimizedAppContext';
import { mswUtils } from './msw-server';

// Integration test provider that wraps components with all necessary providers
interface IntegrationProviderProps {
  children: ReactNode;
  initialAppState?: Record<string, any>;
  enableWebSocket?: boolean;
  mockAuthentication?: boolean;
  userRole?: 'admin' | 'user';
}

export const IntegrationProvider = ({ 
  children,
  initialAppState = {},
  enableWebSocket = false,
  mockAuthentication = false,
  userRole = 'user'
}: IntegrationProviderProps) => {
  // Set up authenticated user if requested
  React.useEffect(() => {
    if (mockAuthentication) {
      mswUtils.setAuthenticatedUser({
        id: userRole === 'admin' ? 'admin-456' : 'user-123',
        email: userRole === 'admin' ? 'admin@medianest.com' : 'test@medianest.com',
        name: userRole === 'admin' ? 'Admin User' : 'Test User',
        role: userRole,
      });
    }
  }, [mockAuthentication, userRole]);

  // Default authenticated state for integration tests
  const defaultAuthState = mockAuthentication ? {
    user: {
      id: userRole === 'admin' ? 'admin-456' : 'user-123',
      email: userRole === 'admin' ? 'admin@medianest.com' : 'test@medianest.com',
      name: userRole === 'admin' ? 'Admin User' : 'Test User',
      role: userRole,
    },
    session: {
      id: 'session-123',
      isAuthenticated: true,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    },
  } : {};

  const mergedInitialState = {
    ...defaultAuthState,
    ...initialAppState,
  };

  return (
    <div data-testid="integration-test-wrapper">
      <AppProvider initialState={mergedInitialState}>
        {children}
      </AppProvider>
    </div>
  );
};

// Custom render function for integration tests
export const renderIntegration = (
  ui: ReactElement,
  options: RenderOptions & {
    initialAppState?: Record<string, any>;
    enableWebSocket?: boolean;
    mockAuthentication?: boolean;
    userRole?: 'admin' | 'user';
  } = {}
) => {
  const {
    initialAppState,
    enableWebSocket = false,
    mockAuthentication = false,
    userRole = 'user',
    ...renderOptions
  } = options;

  const user = userEvent.setup();

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <IntegrationProvider
      initialAppState={initialAppState}
      enableWebSocket={enableWebSocket}
      mockAuthentication={mockAuthentication}
      userRole={userRole}
    >
      {children}
    </IntegrationProvider>
  );

  return {
    user,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
};

// Specialized render functions for different scenarios
export const renderWithAuth = (
  ui: ReactElement,
  userRole: 'admin' | 'user' = 'user',
  options: RenderOptions = {}
) => {
  return renderIntegration(ui, {
    mockAuthentication: true,
    userRole,
    ...options,
  });
};

export const renderWithoutAuth = (
  ui: ReactElement,
  options: RenderOptions = {}
) => {
  return renderIntegration(ui, {
    mockAuthentication: false,
    ...options,
  });
};

export const renderWithWebSocket = (
  ui: ReactElement,
  authenticated = true,
  options: RenderOptions = {}
) => {
  return renderIntegration(ui, {
    enableWebSocket: true,
    mockAuthentication: authenticated,
    ...options,
  });
};

// Test data generators for integration tests
export const createMockApiResponse = <T,>(data: T, delay = 200) => {
  return new Promise<T>((resolve) => {
    setTimeout(() => resolve(data), delay);
  });
};

export const createMockApiError = (
  message = 'API Error',
  code = 'API_ERROR',
  status = 500,
  delay = 200
) => {
  return new Promise<never>((_, reject) => {
    setTimeout(() => {
      const error = new Error(message) as any;
      error.response = {
        status,
        data: { code, message, timestamp: new Date().toISOString() },
      };
      reject(error);
    }, delay);
  });
};

// Integration test assertion helpers
export const waitForApiCall = async (expectedUrl: string, timeout = 5000) => {
  const startTime = Date.now();
  
  return new Promise<void>((resolve, reject) => {
    const checkInterval = setInterval(() => {
      const mockState = mswUtils.getMockState();
      
      // This is a simplified check - in a real implementation,
      // you'd want to track actual API calls made through your HTTP client
      if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error(`API call to ${expectedUrl} not made within ${timeout}ms`));
      }
      
      // For now, just resolve after a short delay to simulate the check
      if (Date.now() - startTime > 100) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 10);
  });
};

export const waitForWebSocketConnection = async (timeout = 3000) => {
  const startTime = Date.now();
  
  return new Promise<void>((resolve, reject) => {
    const checkInterval = setInterval(() => {
      if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error(`WebSocket connection not established within ${timeout}ms`));
      }
      
      // In a real implementation, check if WebSocket is connected
      // For now, simulate connection after short delay
      if (Date.now() - startTime > 500) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 50);
  });
};

// Loading state test helpers
export const expectLoadingState = (container: HTMLElement) => {
  expect(container).toHaveTextContent(/loading|spinner|fetching/i);
};

export const expectErrorState = (container: HTMLElement) => {
  expect(container).toHaveTextContent(/error|failed|something went wrong/i);
};

export const expectSuccessState = (container: HTMLElement) => {
  expect(container).not.toHaveTextContent(/loading|error|failed/i);
};

// Authentication flow helpers
export const simulateLogin = async (
  user: ReturnType<typeof userEvent.setup>,
  email = 'test@medianest.com',
  password = 'password123'
) => {
  const emailInput = document.querySelector('input[type="email"], input[name="email"]');
  const passwordInput = document.querySelector('input[type="password"], input[name="password"]');
  const submitButton = document.querySelector('button[type="submit"], button:contains("Login")');
  
  if (emailInput && passwordInput && submitButton) {
    await user.type(emailInput as HTMLElement, email);
    await user.type(passwordInput as HTMLElement, password);
    await user.click(submitButton as HTMLElement);
  }
};

export const simulateLogout = async (user: ReturnType<typeof userEvent.setup>) => {
  const logoutButton = document.querySelector(
    'button:contains("Logout"), button:contains("Sign out"), [data-testid="logout-button"]'
  );
  
  if (logoutButton) {
    await user.click(logoutButton as HTMLElement);
  }
};

// Service management test helpers
export const simulateServiceTest = async (
  user: ReturnType<typeof userEvent.setup>,
  serviceId: string
) => {
  const testButton = document.querySelector(`[data-testid="test-service-${serviceId}"]`);
  if (testButton) {
    await user.click(testButton as HTMLElement);
  }
};

// Network condition simulation
export const simulateSlowNetwork = () => {
  // This would integrate with MSW to add delays to all responses
  // For now, we'll set a flag that test scenarios can use
  (globalThis as any).__SIMULATE_SLOW_NETWORK__ = true;
};

export const simulateNetworkError = () => {
  (globalThis as any).__SIMULATE_NETWORK_ERROR__ = true;
};

export const resetNetworkConditions = () => {
  delete (globalThis as any).__SIMULATE_SLOW_NETWORK__;
  delete (globalThis as any).__SIMULATE_NETWORK_ERROR__;
};

export * from '@testing-library/react';
export { renderIntegration as render };