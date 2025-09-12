/**
 * Comprehensive Test Suite for ErrorBoundary Component
 * Testing: Render, Error Handling, Props, Accessibility, Edge Cases
 */

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { renderWithErrorBoundarySupport } from '../../test-utils/errorBoundaryHelpers';
import { ThrowError, ThrowAsyncError, suppressErrorOutput } from '../../test-utils/render';
import ErrorBoundary, { withErrorBoundary } from '../ErrorBoundary';

// Suppress React error logging during error boundary tests
const originalConsoleError = console.error;

describe('ErrorBoundary Component', () => {
  // Mock console methods to suppress error output during tests
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleGroupSpy: ReturnType<typeof vi.spyOn>;
  let consoleGroupEndSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    // Globally suppress React error output for this test suite
    console.error = vi.fn();
  });

  afterAll(() => {
    // Restore console.error after all tests
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    // Clear any existing mocks and create fresh ones
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleGroupSpy.mockRestore();
    consoleGroupEndSpy.mockRestore();
  });

  describe('Render Tests', () => {
    it('should render children when no error occurs', () => {
      const TestComponent = () => <div data-testid='child'>Child content</div>;

      render(
        <ErrorBoundary>
          <TestComponent />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Child content')).toBeVisible();
    });

    it('should render multiple children correctly', () => {
      render(
        <ErrorBoundary>
          <div data-testid='child-1'>First child</div>
          <div data-testid='child-2'>Second child</div>
          <span data-testid='child-3'>Third child</span>
        </ErrorBoundary>,
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
      expect(screen.getByTestId('child-3')).toBeInTheDocument();
    });

    it('should have correct component display name', () => {
      expect(ErrorBoundary.name).toBe('ErrorBoundary');
    });
  });

  describe('Error Handling Tests', () => {
    it('should catch and display error when child component throws', () => {
      render(
        <ErrorBoundary>
          <ThrowError message='Test error message' />
        </ErrorBoundary>,
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeVisible();
      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('should display component stack in error details', () => {
      render(
        <ErrorBoundary>
          <ThrowError message='Stack trace test' />
        </ErrorBoundary>,
      );

      const detailsElement = screen.getByText('Error Details');
      expect(detailsElement).toBeInTheDocument();

      fireEvent.click(detailsElement);
      expect(screen.getByText('Stack trace test')).toBeVisible();
    });

    it('should call onError callback when error occurs', () => {
      const onErrorSpy = vi.fn();

      render(
        <ErrorBoundary onError={onErrorSpy}>
          <ThrowError message='Callback test error' />
        </ErrorBoundary>,
      );

      expect(onErrorSpy).toHaveBeenCalledTimes(1);
      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Callback test error',
        }),
        expect.objectContaining({
          componentStack: expect.any(String),
        }),
      );
    });

    it('should not call onError callback when no error occurs', () => {
      const onErrorSpy = vi.fn();

      render(
        <ErrorBoundary onError={onErrorSpy}>
          <div>No error here</div>
        </ErrorBoundary>,
      );

      expect(onErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle multiple errors correctly', () => {
      const onErrorSpy = vi.fn();

      const { rerender } = render(
        <ErrorBoundary onError={onErrorSpy}>
          <div>No error initially</div>
        </ErrorBoundary>,
      );

      // First error
      rerender(
        <ErrorBoundary onError={onErrorSpy}>
          <ThrowError message='First error' />
        </ErrorBoundary>,
      );

      expect(onErrorSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText('First error')).toBeInTheDocument();
    });
  });

  describe('Custom Fallback Tests', () => {
    it('should render custom fallback when provided', () => {
      const customFallback = (error: Error) => (
        <div data-testid='custom-fallback'>Custom error: {error.message}</div>
      );

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError message='Custom fallback test' />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByText('Custom error: Custom fallback test')).toBeVisible();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('should pass error info to custom fallback', () => {
      const customFallback = (error: Error, errorInfo: any) => (
        <div data-testid='custom-fallback'>
          <div data-testid='error-message'>{error.message}</div>
          <div data-testid='component-stack'>
            {errorInfo.componentStack ? 'Has stack' : 'No stack'}
          </div>
        </div>
      );

      expect(() => {
        render(
          <ErrorBoundary fallback={customFallback}>
            <ThrowError message='Fallback info test' />
          </ErrorBoundary>,
        );
      }).not.toThrow();

      expect(screen.getByTestId('error-message')).toHaveTextContent('Fallback info test');
      expect(screen.getByTestId('component-stack')).toHaveTextContent('Has stack');
    });

    it('should handle custom fallback that throws error gracefully', () => {
      const faultyFallback = () => {
        throw new Error('Fallback error');
      };

      expect(() => {
        render(
          <ErrorBoundary fallback={faultyFallback}>
            <ThrowError message='Original error' />
          </ErrorBoundary>,
        );
      }).not.toThrow();

      // Should still render something (likely default error UI or crash)
      expect(document.body).toBeTruthy();
    });
  });

  describe('Retry Functionality Tests', () => {
    it('should show retry button in default error UI', () => {
      expect(() => {
        render(
          <ErrorBoundary>
            <ThrowError message='Retry test error' />
          </ErrorBoundary>,
        );
      }).not.toThrow();

      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();
      expect(retryButton).toBeVisible();
    });

    it('should reset error state when retry button is clicked', async () => {
      let shouldThrowError = true;
      const TestComponent = () => {
        if (shouldThrowError) {
          throw new Error('Retry functionality test');
        }
        return <div data-testid='success'>Component rendered successfully</div>;
      };

      expect(() => {
        render(
          <ErrorBoundary>
            <TestComponent />
          </ErrorBoundary>,
        );
      }).not.toThrow();

      // Initially shows error
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Fix the component
      shouldThrowError = false;

      // Click retry
      const retryButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(retryButton);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByTestId('success')).toBeInTheDocument();
      });

      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('should handle retry timeout cleanup', () => {
      const TestComponent = () => {
        throw new Error('Timeout test error');
      };

      const { unmount } = render(
        <ErrorBoundary>
          <TestComponent />
        </ErrorBoundary>,
      );

      const retryButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(retryButton);

      // Unmount component to test cleanup
      expect(() => {
        unmount();
      }).not.toThrow();

      // No specific assertion needed - test passes if no errors thrown during cleanup
      expect(true).toBe(true);
    });
  });

  describe('Accessibility Tests', () => {
    it('should have proper ARIA attributes in error state', () => {
      expect(() => {
        render(
          <ErrorBoundary>
            <ThrowError message='Accessibility test' />
          </ErrorBoundary>,
        );
      }).not.toThrow();

      const errorContainer = screen.getByRole('alert');
      expect(errorContainer).toHaveAttribute('aria-live', 'assertive');
      expect(errorContainer).toHaveClass('error-boundary');
    });

    it('should have accessible retry button', () => {
      expect(() => {
        render(
          <ErrorBoundary>
            <ThrowError message='Button accessibility test' />
          </ErrorBoundary>,
        );
      }).not.toThrow();

      const retryButton = screen.getByRole('button', { name: /retry rendering component/i });
      expect(retryButton).toHaveAttribute('type', 'button');
      expect(retryButton).toHaveAttribute('aria-label', 'Retry rendering component');
    });

    it('should be keyboard navigable', () => {
      expect(() => {
        render(
          <ErrorBoundary>
            <ThrowError message='Keyboard test' />
          </ErrorBoundary>,
        );
      }).not.toThrow();

      const retryButton = screen.getByRole('button', { name: /try again/i });

      retryButton.focus();
      expect(document.activeElement).toBe(retryButton);
    });

    it('should support screen readers with details element', () => {
      expect(() => {
        render(
          <ErrorBoundary>
            <ThrowError message='Screen reader test' />
          </ErrorBoundary>,
        );
      }).not.toThrow();

      const summary = screen.getByText('Error Details');
      expect(summary.closest('details')).toBeInTheDocument();

      // Details should be expandable
      fireEvent.click(summary);
      expect(summary.closest('details')).toHaveAttribute('open');
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle null children gracefully', () => {
      render(<ErrorBoundary>{null}</ErrorBoundary>);

      // Should render without errors
      expect(document.body).toBeTruthy();
    });

    it('should handle undefined children gracefully', () => {
      render(<ErrorBoundary>{undefined}</ErrorBoundary>);

      // Should render without errors
      expect(document.body).toBeTruthy();
    });

    it('should handle empty children gracefully', () => {
      render(<ErrorBoundary></ErrorBoundary>);

      // Should render without errors
      expect(document.body).toBeTruthy();
    });

    it('should handle boolean children gracefully', () => {
      render(
        <ErrorBoundary>
          {true}
          {false}
        </ErrorBoundary>,
      );

      // Should render without errors
      expect(document.body).toBeTruthy();
    });

    it('should handle complex nested components', () => {
      const DeepChild = () => <div>Deep child</div>;
      const MiddleChild = () => (
        <div>
          <DeepChild />
        </div>
      );
      const TopChild = () => (
        <div>
          <MiddleChild />
        </div>
      );

      render(
        <ErrorBoundary>
          <TopChild />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Deep child')).toBeInTheDocument();
    });

    it('should handle error in deeply nested component', () => {
      const DeepErrorChild = () => {
        throw new Error('Deep nested error');
      };
      const MiddleChild = () => (
        <div>
          <DeepErrorChild />
        </div>
      );
      const TopChild = () => (
        <div>
          <MiddleChild />
        </div>
      );

      expect(() => {
        render(
          <ErrorBoundary>
            <TopChild />
          </ErrorBoundary>,
        );
      }).not.toThrow();

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Deep nested error')).toBeInTheDocument();
    });

    it('should handle error with special characters in message', () => {
      const specialMessage = 'Error with <script>alert("xss")</script> & special chars';

      expect(() => {
        render(
          <ErrorBoundary>
            <ThrowError message={specialMessage} />
          </ErrorBoundary>,
        );
      }).not.toThrow();

      expect(screen.getByText(specialMessage)).toBeInTheDocument();
    });

    it('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(1000) + ' very long error message ' + 'B'.repeat(1000);

      expect(() => {
        render(
          <ErrorBoundary>
            <ThrowError message={longMessage} />
          </ErrorBoundary>,
        );
      }).not.toThrow();

      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('should handle errors with no message', () => {
      const EmptyErrorComponent = () => {
        const error = new Error();
        error.message = '';
        throw error;
      };

      expect(() => {
        render(
          <ErrorBoundary>
            <EmptyErrorComponent />
          </ErrorBoundary>,
        );
      }).not.toThrow();

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('Development vs Production Behavior', () => {
    it('should log errors in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // Don't suppress console methods for this test - we want to check them
      // But temporarily restore them so we can spy on actual calls
      consoleSpy.mockRestore();
      consoleGroupSpy.mockRestore();
      consoleGroupEndSpy.mockRestore();

      // Set up fresh spies
      const devConsoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const devConsoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
      const devConsoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

      try {
        expect(() => {
          render(
            <ErrorBoundary>
              <ThrowError message='Development logging test' />
            </ErrorBoundary>,
          );
        }).not.toThrow();

        expect(devConsoleGroupSpy).toHaveBeenCalledWith('=🚨 ErrorBoundary caught an error:');
        expect(devConsoleSpy).toHaveBeenCalledWith(
          'Error:',
          expect.objectContaining({ message: 'Development logging test' }),
        );
        expect(devConsoleSpy).toHaveBeenCalledWith('Component Stack:', expect.any(String));
        expect(devConsoleGroupEndSpy).toHaveBeenCalled();
      } finally {
        devConsoleSpy.mockRestore();
        devConsoleGroupSpy.mockRestore();
        devConsoleGroupEndSpy.mockRestore();

        // Restore original spies
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
        consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should not log errors in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Don't suppress console methods for this test - we want to check they're NOT called
      consoleSpy.mockRestore();
      consoleGroupSpy.mockRestore();
      consoleGroupEndSpy.mockRestore();

      // Set up fresh spies
      const prodConsoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const prodConsoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
      const prodConsoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

      try {
        expect(() => {
          render(
            <ErrorBoundary>
              <ThrowError message='Production logging test' />
            </ErrorBoundary>,
          );
        }).not.toThrow();

        expect(prodConsoleGroupSpy).not.toHaveBeenCalled();
        expect(prodConsoleGroupEndSpy).not.toHaveBeenCalled();
      } finally {
        prodConsoleSpy.mockRestore();
        prodConsoleGroupSpy.mockRestore();
        prodConsoleGroupEndSpy.mockRestore();

        // Restore original spies
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
        consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});

describe('withErrorBoundary HOC', () => {
  it('should wrap component with error boundary', () => {
    const TestComponent = ({ name }: { name: string }) => (
      <div data-testid='wrapped-component'>Hello {name}</div>
    );

    const WrappedComponent = withErrorBoundary(TestComponent);

    render(<WrappedComponent name='World' />);

    expect(screen.getByTestId('wrapped-component')).toBeInTheDocument();
    expect(screen.getByText('Hello World')).toBeVisible();
  });

  it('should set correct display name for wrapped component', () => {
    const TestComponent = () => <div>Test</div>;
    TestComponent.displayName = 'TestComponent';

    const WrappedComponent = withErrorBoundary(TestComponent);

    expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)');
  });

  it('should use component name when displayName is not available', () => {
    const TestComponent = () => <div>Test</div>;

    const WrappedComponent = withErrorBoundary(TestComponent);

    expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)');
  });

  it('should pass through error boundary props', () => {
    const onErrorSpy = vi.fn();
    const customFallback = () => <div>Custom fallback</div>;

    const TestComponent = () => {
      throw new Error('HOC error test');
    };

    const WrappedComponent = withErrorBoundary(TestComponent, {
      onError: onErrorSpy,
      fallback: customFallback,
    });

    expect(() => {
      render(<WrappedComponent />);
    }).not.toThrow();

    expect(onErrorSpy).toHaveBeenCalled();
    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
  });

  it('should catch errors in wrapped component', () => {
    const ErrorComponent = () => {
      throw new Error('Wrapped component error');
    };

    const WrappedComponent = withErrorBoundary(ErrorComponent);

    expect(() => {
      render(<WrappedComponent />);
    }).not.toThrow();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should preserve component props and functionality', () => {
    interface TestProps {
      title: string;
      onClick: () => void;
    }

    const TestComponent = ({ title, onClick }: TestProps) => (
      <button data-testid='test-button' onClick={onClick}>
        {title}
      </button>
    );

    const WrappedComponent = withErrorBoundary(TestComponent);
    const handleClick = vi.fn();

    render(<WrappedComponent title='Click Me' onClick={handleClick} />);

    const button = screen.getByTestId('test-button');
    expect(button).toHaveTextContent('Click Me');

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
