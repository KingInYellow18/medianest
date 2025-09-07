import React, { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import userEvent from '@testing-library/user-event';

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  session?: any;
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement<any>,
  {
    session = null,
    queryClient = createTestQueryClient(),
    ...renderOptions
  }: CustomRenderOptions = {},
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    return (
      <SessionProvider session={session}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </SessionProvider>
    );
  };

  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// Create a test QueryClient with sensible defaults
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  });
}

// Mock session data generators
export const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user' as const,
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

export const mockAdminSession = {
  ...mockSession,
  user: {
    ...mockSession.user,
    role: 'admin' as const,
  },
};

// Test helper functions
export function waitForLoadingToFinish() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export async function clickAndWait(element: HTMLElement) {
  await userEvent.click(element);
  await waitForLoadingToFinish();
}

// Custom matchers can be added here if needed
export * from '@testing-library/react';
export { userEvent };
