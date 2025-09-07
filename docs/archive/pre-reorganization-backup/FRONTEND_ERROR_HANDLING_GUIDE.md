# MediaNest Frontend Error Handling Guide

**Version:** 1.0  
**Date:** January 2025  
**Status:** Complete

## Overview

This guide documents the comprehensive error handling infrastructure implemented in the MediaNest frontend. The system provides user-friendly error messages, automatic error reporting, and graceful degradation when services fail.

## Error Handling Components

### 1. Error Boundary Components

#### Main Error Boundary (`/frontend/src/components/ErrorBoundary.tsx`)

- Wraps the entire application
- Catches JavaScript errors anywhere in the component tree
- Displays user-friendly error messages
- Logs errors to the error reporting service

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Usage in layout
<ErrorBoundary>
  <App />
</ErrorBoundary>;
```

#### Service Error Boundary (`/frontend/src/components/ServiceErrorBoundary.tsx`)

- Specialized for service-specific failures
- Shows service unavailable messages
- Provides retry functionality

```tsx
import { ServiceErrorBoundary } from '@/components/ServiceErrorBoundary';

// Usage
<ServiceErrorBoundary serviceName="Plex Media Server">
  <PlexLibraryComponent />
</ServiceErrorBoundary>;
```

### 2. API Client (`/frontend/src/lib/api/client.ts`)

The centralized API client handles all error parsing and standardization:

```tsx
// All API calls automatically handle errors
const data = await apiClient.get('/media/search', { params });
// Throws typed AppError instances on failure
```

Features:

- Automatic error parsing based on status codes
- Correlation ID tracking
- Error logging
- Standardized error response format

### 3. Error Handler Hook (`/frontend/src/hooks/useErrorHandler.ts`)

Custom hook for handling errors in React components:

```tsx
const { handleError, isRetrying, retry } = useErrorHandler({
  onAuthError: () => router.push('/auth/signin'),
});

// In component
try {
  await someAsyncOperation();
} catch (error) {
  handleError(error, { context: 'media-search' });
}
```

Features:

- Authentication error handling
- Rate limit detection
- Retry functionality
- Error logging with context

### 4. Error Logger (`/frontend/src/lib/error-logger.ts`)

Automatic error collection and reporting:

```tsx
// Initialized automatically in providers.tsx
initializeErrorLogger({
  enabled: process.env.NODE_ENV === 'production',
  sampleRate: 1.0,
});
```

Features:

- Global error handlers for unhandled errors
- Batched error reporting
- Configurable sampling
- Excluded common browser errors

## Error Types

All error types are imported from the shared package:

```tsx
import {
  AppError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  ServiceUnavailableError,
  NotFoundError,
} from '@medianest/shared';
```

## User-Friendly Error Messages

Error codes are automatically mapped to user-friendly messages:

```tsx
// From shared/src/errors/utils.ts
const USER_FRIENDLY_MESSAGES = {
  AUTH_FAILED: 'Please log in to continue.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later.',
  SERVICE_UNAVAILABLE: 'This service is temporarily unavailable.',
  // ... etc
};
```

## Implementation Examples

### 1. Component with Error Handling

```tsx
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { apiClient } from '@/lib/api/client';

export function MediaSearch() {
  const { handleError } = useErrorHandler();
  const [loading, setLoading] = useState(false);

  const searchMedia = async (query: string) => {
    setLoading(true);
    try {
      const results = await apiClient.get('/media/search', {
        params: { q: query }
      });
      // Handle results
    } catch (error) {
      handleError(error, {
        context: 'media-search',
        query
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    // Component UI
  );
}
```

### 2. Service with Graceful Degradation

```tsx
import { ServiceErrorBoundary } from '@/components/ServiceErrorBoundary';
import { useServiceStatus } from '@/hooks/useServiceStatus';

export function PlexDashboard() {
  const { isAvailable, checkStatus } = useServiceStatus('plex');

  if (!isAvailable) {
    return (
      <div className="p-4 bg-yellow-50 rounded">
        <p>Plex is temporarily unavailable</p>
        <button onClick={checkStatus}>Retry</button>
      </div>
    );
  }

  return (
    <ServiceErrorBoundary serviceName="Plex">
      <PlexContent />
    </ServiceErrorBoundary>
  );
}
```

### 3. Form with Validation Errors

```tsx
import { useForm } from 'react-hook-form';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { ValidationError } from '@medianest/shared';

export function MediaRequestForm() {
  const { handleError } = useErrorHandler();
  const { register, handleSubmit, setError } = useForm();

  const onSubmit = async (data) => {
    try {
      await apiClient.post('/media/request', data);
    } catch (error) {
      if (error instanceof ValidationError && error.details) {
        // Set form field errors
        Object.entries(error.details).forEach(([field, message]) => {
          setError(field, { message });
        });
      } else {
        handleError(error);
      }
    }
  };

  return <form onSubmit={handleSubmit(onSubmit)}>{/* Form fields */}</form>;
}
```

## Global Error Handling

The application automatically handles:

1. **Unhandled Promise Rejections**: Caught and logged
2. **Component Errors**: Caught by Error Boundaries
3. **API Errors**: Standardized by API client
4. **Network Errors**: User-friendly offline messages

## Error Reporting

Errors are automatically reported to the backend in production:

```
POST /api/v1/errors/report
{
  errors: [{
    timestamp: "2025-01-14T10:00:00Z",
    level: "error",
    message: "Failed to load media",
    error: {
      message: "Network request failed",
      stack: "...",
      code: "NETWORK_ERROR"
    },
    context: { component: "MediaGrid" }
  }],
  userAgent: "...",
  url: "https://medianest.example.com/media"
}
```

## Best Practices

1. **Always use the error handler hook** in components that make API calls
2. **Wrap service-specific components** with ServiceErrorBoundary
3. **Provide context** when logging errors for better debugging
4. **Show user-friendly messages** instead of technical details
5. **Implement retry logic** for transient failures
6. **Test error scenarios** to ensure graceful handling

## Testing Error Handling

```tsx
// Example test
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

test('displays error message when component throws', () => {
  const ThrowError = () => {
    throw new Error('Test error');
  };

  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>,
  );

  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
});
```

## Configuration

Environment variables:

- `NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT`: Backend endpoint for error reports
- `NODE_ENV`: Controls error logging behavior (production vs development)

## Summary

The MediaNest frontend error handling system provides:

- 🛡️ **Protection**: Error boundaries prevent crashes
- 🎯 **User Experience**: Clear, actionable error messages
- 📊 **Visibility**: Automatic error reporting and logging
- 🔄 **Resilience**: Retry logic and graceful degradation
- 🔍 **Debugging**: Correlation IDs and structured logging
