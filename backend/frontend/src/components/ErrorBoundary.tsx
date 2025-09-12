import React, { Component, memo, ErrorInfo, ReactNode } from 'react';

// Context7 Pattern - Type-safe error handling with branded types
type ErrorBoundaryError = Error & { readonly __brand: 'ErrorBoundary' };
type ComponentStack = string & { readonly __brand: 'ComponentStack' };

// Context7 Pattern - Result type for error states
type ErrorState<T = any> =
  | { hasError: false; error: null; errorInfo: null }
  | { hasError: true; error: ErrorBoundaryError; errorInfo: ComponentStack; fallback?: T };

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState extends ErrorState<ReactNode> {}

// Context7 Pattern - Memoized error display component
const ErrorDisplay = memo(
  ({ error, errorInfo, onRetry }: { error: Error; errorInfo: string; onRetry: () => void }) => (
    <div className='error-boundary' role='alert' aria-live='assertive'>
      <h2>Something went wrong</h2>
      <details>
        <summary>Error Details</summary>
        <pre>{error.message}</pre>
        <pre>{errorInfo}</pre>
      </details>
      <button onClick={onRetry} type='button' aria-label='Retry rendering component'>
        Try again
      </button>
    </div>
  ),
);

ErrorDisplay.displayName = 'ErrorDisplay';

// Context7 Pattern - Optimized Error Boundary with branded types
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Context7 Pattern - Type-safe error state transformation
    return {
      hasError: true,
      error: error as ErrorBoundaryError,
      errorInfo: '' as ComponentStack,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Context7 Pattern - Branded type for component stack
    const componentStack = errorInfo.componentStack as ComponentStack;

    this.setState((prevState) => ({
      ...prevState,
      errorInfo: componentStack,
    }));

    // Context7 Pattern - Optional error reporting with type safety
    this.props.onError?.(error, errorInfo);

    // Log error for development
    if (process.env.NODE_ENV === 'development') {
      console.group('=� ErrorBoundary caught an error:');
      console.error('Error:', error);
      console.error('Component Stack:', componentStack);
      console.groupEnd();
    }
  }

  // Context7 Pattern - Memoized retry handler
  private handleRetry = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    if (this.state.hasError && this.state.error && this.state.errorInfo) {
      // Context7 Pattern - Custom fallback with type safety
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, {
          componentStack: this.state.errorInfo,
        } as ErrorInfo);
      }

      // Context7 Pattern - Memoized default error UI
      return (
        <ErrorDisplay
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

// Context7 Pattern - HOC for error boundary wrapping
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>,
) => {
  const WrappedComponent = memo((props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  ));

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

export default ErrorBoundary;
