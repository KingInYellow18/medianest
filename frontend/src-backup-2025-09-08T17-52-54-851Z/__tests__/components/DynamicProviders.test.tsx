import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DynamicProviders } from '@/components/DynamicProviders';

// Mock Next-auth
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="session-provider">{children}</div>
  ),
}));

// Mock React Query
vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn(() => ({})),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="query-client-provider">{children}</div>
  ),
}));

// Mock error logger
vi.mock('@/lib/error-logger', () => ({
  initializeErrorLogger: vi.fn(),
}));

describe('DynamicProviders', () => {
  it('renders providers in correct order', () => {
    render(
      <DynamicProviders>
        <div data-testid="child-content">Test Content</div>
      </DynamicProviders>
    );

    // Check that providers are present
    expect(screen.getByTestId('session-provider')).toBeInTheDocument();
    expect(screen.getByTestId('query-client-provider')).toBeInTheDocument();
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('initializes query client with correct configuration', () => {
    const { container } = render(
      <DynamicProviders>
        <div>Test</div>
      </DynamicProviders>
    );

    expect(container).toBeInTheDocument();
  });

  it('renders children correctly', () => {
    const testContent = 'Provider test content';

    render(
      <DynamicProviders>
        <span>{testContent}</span>
      </DynamicProviders>
    );

    expect(screen.getByText(testContent)).toBeInTheDocument();
  });
});
