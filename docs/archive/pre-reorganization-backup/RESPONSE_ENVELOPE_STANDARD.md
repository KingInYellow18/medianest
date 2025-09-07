# MediaNest API Response Envelope Standard

**Version:** 1.0  
**Date:** January 2025  
**Status:** Proposed Standard

## Overview

This document defines a standardized response envelope structure for all MediaNest API endpoints to ensure consistency, predictability, and ease of use for API consumers.

## Current State Analysis

Currently, MediaNest uses a partial envelope structure with some inconsistencies:

### What's Working Well ✅

- Most endpoints use `{ success: true/false }` pattern
- Error responses include structured error objects
- Pagination endpoints have consistent pagination info

### Inconsistencies to Address ⚠️

- Some endpoints return data directly vs. wrapped in `data` property
- Health endpoint doesn't follow the envelope pattern
- WebSocket events don't have consistent structure
- Some errors missing error codes

## Proposed Standard

### Success Response Envelope

```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    timestamp?: string;
    version?: string;
    requestId?: string;
    [key: string]: any;
  };
}
```

### Error Response Envelope

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string; // Machine-readable error code
    message: string; // Human-readable error message
    details?: any; // Additional error details
    field?: string; // Field that caused the error (validation)
    stack?: string; // Stack trace (dev mode only)
  };
  meta?: {
    timestamp?: string;
    requestId?: string;
    correlationId?: string;
  };
}
```

### Paginated Response Envelope

```typescript
interface PaginatedResponse<T> {
  success: true;
  data: {
    items: T[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  };
  meta?: ResponseMeta;
}
```

## Implementation Guide

### 1. Create Response Utilities

```typescript
// backend/src/utils/response.ts
export class ApiResponse {
  static success<T>(data: T, meta?: Record<string, any>): SuccessResponse<T> {
    return {
      success: true,
      data,
      ...(meta && { meta: { timestamp: new Date().toISOString(), ...meta } }),
    };
  }

  static error(
    code: string,
    message: string,
    details?: any,
    statusCode: number = 500,
  ): ErrorResponse {
    const response: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development' && details?.stack) {
      response.error.stack = details.stack;
    }

    return response;
  }

  static paginated<T>(
    items: T[],
    page: number,
    pageSize: number,
    total: number,
    meta?: Record<string, any>,
  ): PaginatedResponse<T> {
    const totalPages = Math.ceil(total / pageSize);

    return {
      success: true,
      data: {
        items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
      },
      ...(meta && { meta: { timestamp: new Date().toISOString(), ...meta } }),
    };
  }
}
```

### 2. Update Controllers

#### Before:

```typescript
res.json({
  success: true,
  data: users,
});
```

#### After:

```typescript
res.json(ApiResponse.success(users));
```

#### Before (Pagination):

```typescript
res.json({
  success: true,
  data: {
    requests,
    totalCount,
    totalPages,
    currentPage: Number(page),
  },
});
```

#### After (Pagination):

```typescript
res.json(ApiResponse.paginated(requests, Number(page), Number(pageSize), totalCount));
```

### 3. Update Error Handler

```typescript
// backend/src/middleware/error.ts
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  logger.error('Request failed', {
    error: err,
    path: req.path,
    method: req.method,
    correlationId: req.correlationId,
  });

  // Default to 500 if no status code
  const statusCode = err.statusCode || err.status || 500;

  // Determine error code
  const errorCode = err.code || getErrorCode(statusCode);

  // Create error response
  const errorResponse = ApiResponse.error(
    errorCode,
    err.message || 'An unexpected error occurred',
    process.env.NODE_ENV === 'development' ? err : undefined,
    statusCode,
  );

  // Add correlation ID to meta
  if (req.correlationId) {
    errorResponse.meta = {
      ...errorResponse.meta,
      correlationId: req.correlationId,
    };
  }

  res.status(statusCode).json(errorResponse);
};
```

### 4. Standard Error Codes

```typescript
// shared/src/constants/errors.ts
export const ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // External Services
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',

  // Server Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',

  // Business Logic
  INVALID_STATE: 'INVALID_STATE',
  OPERATION_FAILED: 'OPERATION_FAILED',
} as const;
```

## Migration Strategy

### Phase 1: Add Response Utilities (1 day)

1. Create `ApiResponse` utility class
2. Add TypeScript types to shared package
3. Update error handler middleware

### Phase 2: Update Critical Endpoints (2-3 days)

Priority order:

1. Authentication endpoints
2. Media request endpoints
3. Dashboard endpoints
4. Admin endpoints

### Phase 3: Update Remaining Endpoints (1-2 days)

1. Plex endpoints
2. YouTube endpoints
3. Health check endpoint (special case)

### Phase 4: Update Frontend (2-3 days)

1. Update API client to handle new structure
2. Update error handling
3. Update TypeScript types

## Special Cases

### Health Check Endpoint

The health check endpoint should remain simple for monitoring tools:

```typescript
// Keep simple for monitoring tools
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
  });
});

// But add envelope version for consistency
app.get('/api/v1/health', (req, res) => {
  res.json(
    ApiResponse.success({
      status: 'healthy',
      service: 'backend',
      version: '1.0.0',
      uptime: process.uptime(),
    }),
  );
});
```

### WebSocket Events

Standardize WebSocket event structure:

```typescript
interface SocketEvent<T> {
  event: string;
  data: T;
  timestamp: string;
  metadata?: Record<string, any>;
}

// Example usage
socket.emit('service:status', {
  event: 'service:status',
  data: {
    service: 'plex',
    status: 'online',
    responseTime: 123,
  },
  timestamp: new Date().toISOString(),
});
```

## Frontend Integration

### Update API Client

```typescript
// frontend/src/lib/api/client.ts
class ApiClient {
  private async request<T>(method: string, url: string, data?: any): Promise<T> {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: data ? JSON.stringify(data) : undefined,
      });

      const result = await response.json();

      // Handle standardized response
      if (!result.success) {
        throw new ApiError(result.error.code, result.error.message, result.error.details);
      }

      return result.data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('NETWORK_ERROR', 'Network request failed');
    }
  }
}
```

### Type Safety

```typescript
// shared/src/types/api.ts
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: Record<string, any>;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    field?: string;
  };
  meta?: Record<string, any>;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;
```

## Benefits

1. **Consistency**: All endpoints follow the same pattern
2. **Predictability**: Clients always know the response structure
3. **Error Handling**: Standardized error format across all endpoints
4. **Debugging**: Meta information aids in troubleshooting
5. **Evolution**: Easy to add new fields without breaking changes
6. **Type Safety**: Strong TypeScript support

## Testing

### Unit Tests

```typescript
describe('ApiResponse', () => {
  it('should create success response', () => {
    const data = { id: 1, name: 'Test' };
    const response = ApiResponse.success(data);

    expect(response).toEqual({
      success: true,
      data,
    });
  });

  it('should create error response', () => {
    const response = ApiResponse.error('NOT_FOUND', 'User not found', { userId: '123' });

    expect(response).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'User not found',
        details: { userId: '123' },
      },
      meta: {
        timestamp: expect.any(String),
      },
    });
  });
});
```

## Backwards Compatibility

During migration, support both old and new formats:

```typescript
// Temporary compatibility layer
app.use((req, res, next) => {
  // Override res.json to apply envelope if not already applied
  const originalJson = res.json.bind(res);

  res.json = function (data: any) {
    // If already enveloped, send as-is
    if (data && typeof data === 'object' && 'success' in data) {
      return originalJson(data);
    }

    // Apply envelope to non-enveloped responses
    return originalJson(ApiResponse.success(data));
  };

  next();
});
```

## Monitoring

Track adoption of the new format:

```typescript
// Add metrics for response format
app.use((req, res, next) => {
  res.on('finish', () => {
    metrics.increment('api.response', {
      format: res.locals.responseFormat || 'unknown',
      endpoint: req.path,
    });
  });
  next();
});
```

## Documentation Updates

1. Update API documentation to show new response format
2. Update OpenAPI specification with standardized schemas
3. Add migration guide for API consumers
4. Update example code in README and guides

## Timeline

- **Week 1**: Implement utilities and update critical endpoints
- **Week 2**: Update remaining endpoints and frontend
- **Week 3**: Testing and documentation
- **Week 4**: Monitor and fix any issues

## Conclusion

Standardizing the response envelope structure will improve API consistency, make error handling more robust, and provide a better developer experience for both internal and external API consumers.
