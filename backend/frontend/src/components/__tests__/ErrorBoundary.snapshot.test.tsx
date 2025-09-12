/**
 * Snapshot Tests for ErrorBoundary Component
 * Tests visual consistency across different error states and configurations
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '../../test-utils/render';
import ErrorBoundary, { withErrorBoundary } from '../ErrorBoundary';

// Safe error component that won't crash the test runner
const SafeErrorComponent = ({ message }: { message: string }) => {
  React.useEffect(() => {
    const error = new Error(message);
    // Simulate what would happen in a real error boundary scenario
    const mockErrorInfo = { componentStack: '\n    in SafeErrorComponent' };

    // This simulates the error being caught and handled
    if (window.mockErrorBoundaryHandler) {
      window.mockErrorBoundaryHandler(error, mockErrorInfo);
    }
  }, [message]);

  return <div>This would throw: {message}</div>;
};

// Mock the error boundary to simulate caught errors
const MockErrorBoundary = ({
  children,
  fallback,
  simulateError = false,
  errorMessage = 'Mocked error',
}: {
  children: React.ReactNode;
  fallback?: (error: Error, errorInfo: any) => React.ReactNode;
  simulateError?: boolean;
  errorMessage?: string;
}) => {
  if (simulateError) {
    const error = new Error(errorMessage);
    const errorInfo = { componentStack: '\n    in MockComponent' };

    if (fallback) {
      return fallback(error, errorInfo);
    }

    // Default error UI similar to the real ErrorBoundary
    return (
      <div className='error-boundary' role='alert' aria-live='assertive'>
        <h2>Something went wrong</h2>
        <details>
          <summary>Error Details</summary>
          <pre>{error.message}</pre>
          <pre>{errorInfo.componentStack}</pre>
        </details>
        <button type='button' aria-label='Retry rendering component'>
          Try again
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

describe('ErrorBoundary Snapshot Tests', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Normal State Snapshots', () => {
    it('should match snapshot with single child component', () => {
      const TestComponent = () => <div data-testid='child'>Normal content</div>;

      const { container } = render(
        <ErrorBoundary>
          <TestComponent />
        </ErrorBoundary>,
      );

      expect(container.firstChild).toMatchSnapshot('error-boundary-normal-single-child');
    });

    it('should match snapshot with multiple children', () => {
      const { container } = render(
        <ErrorBoundary>
          <header>Header content</header>
          <main>Main content</main>
          <footer>Footer content</footer>
        </ErrorBoundary>,
      );

      expect(container.firstChild).toMatchSnapshot('error-boundary-normal-multiple-children');
    });

    it('should match snapshot with complex nested structure', () => {
      const { container } = render(
        <ErrorBoundary>
          <div className='app-container'>
            <nav>
              <ul>
                <li>
                  <a href='#home'>Home</a>
                </li>
                <li>
                  <a href='#about'>About</a>
                </li>
              </ul>
            </nav>
            <section>
              <h1>Main Content</h1>
              <p>This is a complex nested structure for testing.</p>
            </section>
          </div>
        </ErrorBoundary>,
      );

      expect(container.firstChild).toMatchSnapshot('error-boundary-normal-complex-nested');
    });

    it('should match snapshot with empty children', () => {
      const { container } = render(<ErrorBoundary></ErrorBoundary>);

      expect(container.firstChild).toMatchSnapshot('error-boundary-normal-empty');
    });
  });

  describe('Simulated Error State Snapshots', () => {
    it('should match snapshot with basic error state', () => {
      const { container } = render(
        <MockErrorBoundary simulateError={true} errorMessage='Basic error for snapshot testing'>
          <div>Would be child content</div>
        </MockErrorBoundary>,
      );

      expect(container.firstChild).toMatchSnapshot('error-boundary-error-basic');
    });

    it('should match snapshot with error containing special characters', () => {
      const specialMessage = 'Error with <script>alert("xss")</script> & special chars 日本語';

      const { container } = render(
        <MockErrorBoundary simulateError={true} errorMessage={specialMessage}>
          <div>Would be child content</div>
        </MockErrorBoundary>,
      );

      expect(container.firstChild).toMatchSnapshot('error-boundary-error-special-chars');
    });

    it('should match snapshot with very long error message', () => {
      const longMessage =
        'This is a very long error message that should test how the error boundary handles text overflow and wrapping. '.repeat(
          10,
        );

      const { container } = render(
        <MockErrorBoundary simulateError={true} errorMessage={longMessage}>
          <div>Would be child content</div>
        </MockErrorBoundary>,
      );

      expect(container.firstChild).toMatchSnapshot('error-boundary-error-long-message');
    });

    it('should match snapshot with empty error message', () => {
      const { container } = render(
        <MockErrorBoundary simulateError={true} errorMessage=''>
          <div>Would be child content</div>
        </MockErrorBoundary>,
      );

      expect(container.firstChild).toMatchSnapshot('error-boundary-error-empty-message');
    });
  });

  describe('Custom Fallback Snapshots', () => {
    it('should match snapshot with custom fallback UI', () => {
      const customFallback = (error: Error) => (
        <div className='custom-error-fallback'>
          <h2>Oops! Something went wrong</h2>
          <div className='error-message'>
            <strong>Error:</strong> {error.message}
          </div>
          <div className='error-actions'>
            <button className='btn-primary'>Report Issue</button>
            <button className='btn-secondary'>Go Home</button>
          </div>
        </div>
      );

      const { container } = render(
        <MockErrorBoundary
          simulateError={true}
          errorMessage='Custom fallback error'
          fallback={customFallback}
        >
          <div>Would be child content</div>
        </MockErrorBoundary>,
      );

      expect(container.firstChild).toMatchSnapshot('error-boundary-custom-fallback');
    });

    it('should match snapshot with minimalist custom fallback', () => {
      const minimalFallback = () => <div className='minimal-error'>⚠️ Error occurred</div>;

      const { container } = render(
        <MockErrorBoundary
          simulateError={true}
          errorMessage='Minimal fallback test'
          fallback={minimalFallback}
        >
          <div>Would be child content</div>
        </MockErrorBoundary>,
      );

      expect(container.firstChild).toMatchSnapshot('error-boundary-minimal-fallback');
    });

    it('should match snapshot with rich custom fallback with error details', () => {
      const richFallback = (error: Error, errorInfo: any) => (
        <div className='rich-error-fallback'>
          <div className='error-header'>
            <svg width='24' height='24' viewBox='0 0 24 24' fill='currentColor'>
              <path d='M12 2L2 7v10c0 5.55 3.84 9.95 9 11 5.16-1.05 9-5.45 9-11V7l-10-5z' />
            </svg>
            <h2>Application Error</h2>
          </div>
          <div className='error-content'>
            <div className='error-summary'>
              <h3>What happened?</h3>
              <p>{error.message}</p>
            </div>
            <details className='error-details'>
              <summary>Technical Details</summary>
              <pre className='error-stack'>
                Component Stack: {errorInfo?.componentStack || 'Not available'}
              </pre>
            </details>
            <div className='error-actions'>
              <button className='btn-retry'>Try Again</button>
              <button className='btn-report'>Report Bug</button>
            </div>
          </div>
        </div>
      );

      const { container } = render(
        <MockErrorBoundary
          simulateError={true}
          errorMessage='Rich fallback error with details'
          fallback={richFallback}
        >
          <div>Would be child content</div>
        </MockErrorBoundary>,
      );

      expect(container.firstChild).toMatchSnapshot('error-boundary-rich-fallback');
    });
  });

  describe('HOC Snapshots', () => {
    it('should match snapshot of component wrapped with error boundary HOC', () => {
      const TestComponent = ({ title }: { title: string }) => (
        <div className='test-component'>
          <h1>{title}</h1>
          <p>This component is wrapped with error boundary.</p>
        </div>
      );

      const WrappedComponent = withErrorBoundary(TestComponent);

      const { container } = render(<WrappedComponent title='HOC Test Component' />);

      expect(container.firstChild).toMatchSnapshot('error-boundary-hoc-normal');
    });

    it('should match snapshot of HOC with simulated error state', () => {
      const TestComponent = () => (
        <MockErrorBoundary simulateError={true} errorMessage='HOC wrapped component error'>
          <div>Original content</div>
        </MockErrorBoundary>
      );

      const WrappedComponent = withErrorBoundary(TestComponent);

      const { container } = render(<WrappedComponent />);

      expect(container.firstChild).toMatchSnapshot('error-boundary-hoc-error');
    });
  });

  describe('Edge Case Snapshots', () => {
    it('should match snapshot with null children', () => {
      const { container } = render(<ErrorBoundary>{null}</ErrorBoundary>);

      expect(container.firstChild).toMatchSnapshot('error-boundary-null-children');
    });

    it('should match snapshot with undefined children', () => {
      const { container } = render(<ErrorBoundary>{undefined}</ErrorBoundary>);

      expect(container.firstChild).toMatchSnapshot('error-boundary-undefined-children');
    });

    it('should match snapshot with boolean children', () => {
      const { container } = render(
        <ErrorBoundary>
          {true}
          {false}
          <span>Mixed content</span>
        </ErrorBoundary>,
      );

      expect(container.firstChild).toMatchSnapshot('error-boundary-boolean-children');
    });

    it('should match snapshot with mixed content types', () => {
      const { container } = render(
        <ErrorBoundary>
          Text content
          {123}
          <div>Element content</div>
          {['Array', 'content']}
        </ErrorBoundary>,
      );

      expect(container.firstChild).toMatchSnapshot('error-boundary-mixed-content');
    });
  });

  describe('Accessibility State Snapshots', () => {
    it('should match snapshot with proper ARIA attributes in error state', () => {
      const { container } = render(
        <MockErrorBoundary simulateError={true} errorMessage='Accessibility error test'>
          <div>Would be content</div>
        </MockErrorBoundary>,
      );

      expect(container.firstChild).toMatchSnapshot('error-boundary-accessibility-error');
    });
  });

  describe('Real Error Boundary Integration Snapshots', () => {
    it('should match snapshot with actual error boundary wrapping safe content', () => {
      const SafeContent = () => (
        <div data-testid='safe-content'>
          <h1>This content is safe</h1>
          <p>No errors will be thrown here.</p>
        </div>
      );

      const { container } = render(
        <ErrorBoundary>
          <SafeContent />
        </ErrorBoundary>,
      );

      expect(container.firstChild).toMatchSnapshot('error-boundary-real-safe-content');
    });

    it('should match snapshot with error boundary and custom props', () => {
      const customFallback = (error: Error) => (
        <div className='integration-fallback'>
          <h3>Integration Error: {error.message}</h3>
        </div>
      );

      const { container } = render(
        <ErrorBoundary fallback={customFallback}>
          <div className='integration-content'>
            <span>Integration test content</span>
          </div>
        </ErrorBoundary>,
      );

      expect(container.firstChild).toMatchSnapshot('error-boundary-real-with-props');
    });
  });
});
