import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ErrorBoundary, useErrorHandler, AsyncErrorBoundary } from '../../components/ErrorBoundary';

// Test component that throws errors
function ThrowError({ shouldThrow, errorMessage }: { shouldThrow: boolean; errorMessage: string }) {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div>No error</div>;
}

// Component that uses useErrorHandler hook
function ErrorHandlerComponent() {
  const { resetError, captureError } = useErrorHandler();

  return (
    <div>
      <button onClick={() => captureError(new Error('Test error'))} data-testid="trigger-error">
        Trigger Error
      </button>
      <button onClick={resetError} data-testid="reset-error">
        Reset Error
      </button>
    </div>
  );
}

describe('ErrorBoundary', () => {
  const consoleSpy = vi.spyOn(console, 'error');

  beforeEach(() => {
    consoleSpy.mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockReset();
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child-component">Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByTestId('child-component')).toBeInTheDocument();
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should render default error UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} errorMessage="Test error message" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh Page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    const customFallback = <div data-testid="custom-fallback">Custom error message</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} errorMessage="Test error" />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('should call custom onError handler when error occurs', () => {
    const mockOnError = vi.fn();

    render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowError shouldThrow={true} errorMessage="Custom error" />
      </ErrorBoundary>
    );

    expect(mockOnError).toHaveBeenCalledTimes(1);
    expect(mockOnError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Custom error',
      }),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it('should handle window refresh button click', () => {
    const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} errorMessage="Test error" />
      </ErrorBoundary>
    );

    const refreshButton = screen.getByRole('button', { name: 'Refresh Page' });
    fireEvent.click(refreshButton);

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    reloadSpy.mockRestore();
  });

  it('should handle go back button click', () => {
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} errorMessage="Test error" />
      </ErrorBoundary>
    );

    const backButton = screen.getByRole('button', { name: 'Go Back' });
    fireEvent.click(backButton);

    expect(backSpy).toHaveBeenCalledTimes(1);
    backSpy.mockRestore();
  });

  it('should show error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} errorMessage="Development error" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error Details (Development Only)')).toBeInTheDocument();
    expect(screen.getByText(/"message": "Development error"/)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('should not show error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} errorMessage="Production error" />
      </ErrorBoundary>
    );

    expect(screen.queryByText('Error Details (Development Only)')).not.toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });
});

describe('useErrorHandler', () => {
  const consoleSpy = vi.spyOn(console, 'error');

  beforeEach(() => {
    consoleSpy.mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockReset();
  });

  it('should throw error when captureError is called', async () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ErrorHandlerComponent />
      </ErrorBoundary>
    );

    const triggerButton = screen.getByTestId('trigger-error');
    fireEvent.click(triggerButton);

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  it('should not throw error initially', () => {
    render(
      <ErrorBoundary>
        <ErrorHandlerComponent />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('trigger-error')).toBeInTheDocument();
    expect(screen.getByTestId('reset-error')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});

describe('AsyncErrorBoundary', () => {
  it('should render children with suspense fallback', () => {
    render(
      <AsyncErrorBoundary>
        <div data-testid="async-child">Async content</div>
      </AsyncErrorBoundary>
    );

    expect(screen.getByTestId('async-child')).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    const customFallback = <div data-testid="async-fallback">Custom async fallback</div>;

    render(
      <AsyncErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} errorMessage="Async error" />
      </AsyncErrorBoundary>
    );

    expect(screen.getByTestId('async-fallback')).toBeInTheDocument();
  });

  it('should handle async errors', () => {
    render(
      <AsyncErrorBoundary>
        <ThrowError shouldThrow={true} errorMessage="Async component error" />
      </AsyncErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Async component error')).toBeInTheDocument();
  });
});
