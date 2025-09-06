import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Providers } from '../providers';

// Mock @/config (specific to this test)
vi.mock('@/config', () => ({
  getErrorReportingConfig: vi.fn(() => ({
    endpoint: 'http://localhost:3000/api/errors',
  })),
  isProduction: vi.fn(() => false),
}));

// Mock @/lib/error-logger (specific to this test)
vi.mock('@/lib/error-logger', () => ({
  initializeErrorLogger: vi.fn(),
}));

// Mock the providers
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="session-provider">{children}</div>
  ),
}));

vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn(() => ({
    // Mock QueryClient methods if needed
  })),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="query-client-provider">{children}</div>
  ),
}));

describe('Providers', () => {
  it('renders children wrapped in providers', () => {
    render(
      <Providers>
        <div data-testid="test-child">Test Content</div>
      </Providers>,
    );

    expect(screen.getByTestId('session-provider')).toBeInTheDocument();
    expect(screen.getByTestId('query-client-provider')).toBeInTheDocument();
    expect(screen.getByTestId('test-child')).toBeInTheDocument();
  });

  it('provides proper provider hierarchy', () => {
    render(
      <Providers>
        <div data-testid="nested-content">Nested Content</div>
      </Providers>,
    );

    const sessionProvider = screen.getByTestId('session-provider');
    const queryProvider = screen.getByTestId('query-client-provider');
    const content = screen.getByTestId('nested-content');

    // SessionProvider should contain QueryClientProvider
    expect(sessionProvider).toContainElement(queryProvider);
    // QueryClientProvider should contain the content
    expect(queryProvider).toContainElement(content);
  });

  it('handles multiple children', () => {
    render(
      <Providers>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
        <span data-testid="child-3">Child 3</span>
      </Providers>,
    );

    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
    expect(screen.getByTestId('child-3')).toBeInTheDocument();
  });
});
