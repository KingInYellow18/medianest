# MediaNest API Error Codes Reference

**Version:** 1.0.0  
**Last Updated:** January 15, 2025

## Table of Contents

- [Overview](#overview)
- [Error Response Format](#error-response-format)
- [HTTP Status Codes](#http-status-codes)
- [Error Categories](#error-categories)
- [Detailed Error Codes](#detailed-error-codes)
- [Error Handling Guidelines](#error-handling-guidelines)
- [Troubleshooting Guide](#troubleshooting-guide)

## Overview

MediaNest API uses a comprehensive error handling system with consistent error codes, detailed messages, and actionable information. All errors follow a standardized format to enable programmatic handling and debugging.

### Error Philosophy
- **Consistent Format**: All errors use the same response structure
- **Actionable Messages**: Error messages provide clear guidance on resolution
- **Security-Aware**: Sensitive information is never exposed in error messages
- **Developer-Friendly**: Error codes enable programmatic error handling
- **User-Friendly**: Messages can be displayed directly to end users when appropriate

## Error Response Format

All API errors follow this consistent JSON structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Optional additional context and debugging information
    }
  }
}
```

### Error Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | boolean | Yes | Always `false` for error responses |
| `error` | object | Yes | Error information container |
| `error.code` | string | Yes | Machine-readable error identifier |
| `error.message` | string | Yes | Human-readable error description |
| `error.details` | object | No | Additional context and debugging info |

## HTTP Status Codes

MediaNest uses standard HTTP status codes with specific error code mappings:

| Status Code | Description | Common Error Codes |
|-------------|-------------|-------------------|
| **400** | Bad Request | `VALIDATION_ERROR`, `INVALID_INPUT` |
| **401** | Unauthorized | `UNAUTHORIZED`, `INVALID_TOKEN`, `TOKEN_EXPIRED` |
| **403** | Forbidden | `ACCESS_DENIED`, `INSUFFICIENT_PERMISSIONS` |
| **404** | Not Found | `NOT_FOUND`, `RESOURCE_NOT_FOUND` |
| **409** | Conflict | `DUPLICATE_RESOURCE`, `CONFLICT` |
| **429** | Too Many Requests | `RATE_LIMIT_EXCEEDED` |
| **500** | Internal Server Error | `INTERNAL_ERROR` |
| **502** | Bad Gateway | `EXTERNAL_SERVICE_ERROR`, `PLEX_ERROR` |
| **503** | Service Unavailable | `SERVICE_UNAVAILABLE`, `PLEX_UNREACHABLE` |
| **504** | Gateway Timeout | `PLEX_TIMEOUT`, `TIMEOUT_ERROR` |

## Error Categories

### Authentication Errors (AUTH_*)
Errors related to user authentication and authorization.

### Validation Errors (VALIDATION_*)
Errors related to input validation and data format issues.

### Resource Errors (NOT_FOUND, DUPLICATE_*)
Errors related to resource management and conflicts.

### External Service Errors (PLEX_*, EXTERNAL_*)
Errors related to external service integrations.

### System Errors (INTERNAL_*, DATABASE_*)
Errors related to internal system operations.

### Rate Limiting Errors (RATE_LIMIT_*)
Errors related to rate limiting and abuse prevention.

## Detailed Error Codes

### Authentication & Authorization Errors

#### `UNAUTHORIZED`
**HTTP Status:** 401  
**Description:** Authentication is required but not provided or invalid.

**Common Causes:**
- Missing authentication token
- Invalid JWT token
- Expired session
- Malformed authorization header

**Example Response:**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required. Please log in.",
    "details": {
      "reason": "missing_token",
      "loginUrl": "/auth/plex/pin"
    }
  }
}
```

**Resolution:**
- Authenticate using Plex OAuth flow
- Check that authentication cookies are properly set
- Refresh expired tokens

#### `ACCESS_DENIED`
**HTTP Status:** 403  
**Description:** User lacks sufficient permissions for the requested operation.

**Common Causes:**
- Non-admin user accessing admin endpoints
- User accessing another user's resources
- Role-based permission restrictions

**Example Response:**
```json
{
  "success": false,
  "error": {
    "code": "ACCESS_DENIED",
    "message": "Insufficient permissions for this operation.",
    "details": {
      "required_role": "admin",
      "current_role": "user",
      "resource": "user_management"
    }
  }
}
```

**Resolution:**
- Contact administrator for role elevation
- Ensure accessing only permitted resources
- Check user permissions and roles

#### `TOKEN_ERROR`
**HTTP Status:** 401  
**Description:** JWT token generation or validation failed.

**Common Causes:**
- Invalid token signature
- Token encryption/decryption failure
- Corrupted token data

**Example Response:**
```json
{
  "success": false,
  "error": {
    "code": "TOKEN_ERROR",
    "message": "Authentication token is invalid or corrupted.",
    "details": {
      "token_issue": "signature_verification_failed"
    }
  }
}
```

**Resolution:**
- Re-authenticate to obtain new token
- Clear authentication cookies
- Check for token tampering

### Validation Errors

#### `VALIDATION_ERROR`
**HTTP Status:** 400  
**Description:** Request data failed validation rules.

**Common Causes:**
- Missing required fields
- Invalid data types
- Out-of-range values
- Invalid format (email, URL, etc.)

**Example Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": {
      "errors": [
        {
          "field": "email",
          "message": "Invalid email format",
          "value": "not-an-email"
        },
        {
          "field": "tmdbId",
          "message": "TMDB ID must be a positive integer",
          "value": "-1"
        }
      ]
    }
  }
}
```

**Resolution:**
- Check all required fields are provided
- Validate data types and formats
- Review API documentation for field requirements

#### `INVALID_INPUT`
**HTTP Status:** 400  
**Description:** Input data is semantically invalid or malformed.

**Common Causes:**
- Malformed JSON
- Invalid parameter combinations
- Logical inconsistencies in request data

**Example Response:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Request contains invalid or malformed data.",
    "details": {
      "issue": "malformed_json",
      "line": 5,
      "column": 12
    }
  }
}
```

**Resolution:**
- Validate JSON syntax
- Check parameter combinations
- Review request structure

### Resource Management Errors

#### `NOT_FOUND`
**HTTP Status:** 404  
**Description:** Requested resource does not exist.

**Common Causes:**
- Invalid resource ID
- Resource has been deleted
- Incorrect URL path
- User lacks access to resource

**Example Response:**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested resource was not found.",
    "details": {
      "resource_type": "media_request",
      "resource_id": "123e4567-e89b-12d3-a456-426614174000",
      "possible_reasons": [
        "Resource does not exist",
        "Insufficient permissions",
        "Resource has been deleted"
      ]
    }
  }
}
```

**Resolution:**
- Verify resource ID is correct
- Check user permissions
- Confirm resource still exists

#### `DUPLICATE_RESOURCE`
**HTTP Status:** 409  
**Description:** Attempted to create a resource that already exists.

**Common Causes:**
- Duplicate media request
- Attempting to create existing user
- Unique constraint violations

**Example Response:**
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_RESOURCE",
    "message": "A resource with this identifier already exists.",
    "details": {
      "resource_type": "media_request",
      "existing_id": "existing-request-uuid",
      "conflict_field": "tmdb_id",
      "conflict_value": "27205"
    }
  }
}
```

**Resolution:**
- Check if resource already exists
- Update existing resource instead of creating new
- Use different identifier if appropriate

### External Service Errors

#### `PLEX_ERROR`
**HTTP Status:** 502  
**Description:** General error communicating with Plex services.

**Common Causes:**
- Plex API returned error response
- Invalid Plex token
- Plex server configuration issues

**Example Response:**
```json
{
  "success": false,
  "error": {
    "code": "PLEX_ERROR",
    "message": "Failed to communicate with Plex server.",
    "details": {
      "plex_error": "Invalid authentication token",
      "plex_status": 401,
      "retry_after": 300
    }
  }
}
```

**Resolution:**
- Check Plex server status
- Verify Plex token validity
- Review Plex server configuration

#### `PLEX_UNREACHABLE`
**HTTP Status:** 503  
**Description:** Cannot connect to Plex server.

**Common Causes:**
- Plex server is offline
- Network connectivity issues
- Incorrect Plex server URL
- Firewall blocking connection

**Example Response:**
```json
{
  "success": false,
  "error": {
    "code": "PLEX_UNREACHABLE",
    "message": "Cannot connect to Plex server. Please check server status.",
    "details": {
      "server_url": "https://plex.local:32400",
      "connection_error": "ECONNREFUSED",
      "last_successful": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

**Resolution:**
- Check Plex server is running
- Verify network connectivity
- Confirm Plex server URL
- Check firewall settings

#### `PLEX_TIMEOUT`
**HTTP Status:** 504  
**Description:** Plex server connection or operation timed out.

**Common Causes:**
- Slow network connection
- Overloaded Plex server
- Large library scans in progress
- Network congestion

**Example Response:**
```json
{
  "success": false,
  "error": {
    "code": "PLEX_TIMEOUT",
    "message": "Plex server operation timed out. Please try again.",
    "details": {
      "timeout_duration": 10000,
      "operation": "library_search",
      "suggestion": "Try again in a few minutes"
    }
  }
}
```

**Resolution:**
- Retry the operation
- Check network connection speed
- Wait for Plex server load to decrease
- Increase timeout if possible

#### `PIN_NOT_AUTHORIZED`
**HTTP Status:** 400  
**Description:** Plex PIN has not been authorized by the user.

**Common Causes:**
- User hasn't completed authorization on plex.tv/link
- PIN has expired before authorization
- Incorrect PIN ID provided

**Example Response:**
```json
{
  "success": false,
  "error": {
    "code": "PIN_NOT_AUTHORIZED",
    "message": "PIN has not been authorized yet. Please complete authorization on plex.tv/link.",
    "details": {
      "pin_id": "123456",
      "pin_code": "ABCD-EFGH",
      "expires_at": "2025-01-15T12:15:00.000Z",
      "auth_url": "https://plex.tv/link/?pin=ABCD-EFGH"
    }
  }
}
```

**Resolution:**
- Complete authorization on plex.tv/link
- Generate new PIN if expired
- Verify PIN code is correct

#### `EXTERNAL_SERVICE_ERROR`
**HTTP Status:** 502  
**Description:** Error communicating with external services (Overseerr, etc.).

**Common Causes:**
- Service is temporarily unavailable
- Invalid API credentials
- Service configuration errors

**Example Response:**
```json
{
  "success": false,
  "error": {
    "code": "EXTERNAL_SERVICE_ERROR",
    "message": "External service integration failed.",
    "details": {
      "service": "overseerr",
      "service_error": "API key invalid",
      "service_status": 401,
      "retry_recommended": true
    }
  }
}
```

**Resolution:**
- Check service status
- Verify API credentials
- Review service configuration
- Contact service administrator

### System Errors

#### `INTERNAL_ERROR`
**HTTP Status:** 500  
**Description:** Unexpected server error occurred.

**Common Causes:**
- Unhandled exceptions
- System resource exhaustion
- Configuration errors
- Code bugs

**Example Response:**
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected server error occurred. Please try again.",
    "details": {
      "error_id": "err_abc123xyz",
      "timestamp": "2025-01-15T12:00:00.000Z",
      "support_info": "Please contact support with error ID"
    }
  }
}
```

**Resolution:**
- Retry the operation
- Contact technical support if persists
- Check server logs for details
- Report bug if reproducible

#### `DATABASE_ERROR`
**HTTP Status:** 503  
**Description:** Database operation failed.

**Common Causes:**
- Database connection issues
- Query timeout
- Database server overload
- Data integrity constraints

**Example Response:**
```json
{
  "success": false,
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Database operation failed. Please try again.",
    "details": {
      "operation": "user_create",
      "db_error": "Connection timeout",
      "retry_after": 60
    }
  }
}
```

**Resolution:**
- Retry the operation
- Check database server status
- Wait for database load to decrease
- Contact administrator if persistent

### Rate Limiting Errors

#### `RATE_LIMIT_EXCEEDED`
**HTTP Status:** 429  
**Description:** Request rate limit has been exceeded.

**Common Causes:**
- Too many requests in time window
- Automated client making excessive requests
- Shared IP address limits

**Example Response:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please wait before making more requests.",
    "details": {
      "limit": 100,
      "window": "15 minutes",
      "retry_after": 300,
      "requests_made": 101
    }
  }
}
```

**Response Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1642262400
Retry-After: 300
```

**Resolution:**
- Wait for rate limit window to reset
- Reduce request frequency
- Implement exponential backoff
- Contact support for limit increases

## Error Handling Guidelines

### Client-Side Error Handling

#### JavaScript Example
```javascript
async function handleApiRequest(url, options) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!data.success) {
      throw new ApiError(data.error);
    }
    
    return data.data;
  } catch (error) {
    if (error instanceof ApiError) {
      handleApiError(error);
    } else {
      handleNetworkError(error);
    }
  }
}

class ApiError extends Error {
  constructor(errorInfo) {
    super(errorInfo.message);
    this.code = errorInfo.code;
    this.details = errorInfo.details;
  }
}

function handleApiError(error) {
  switch (error.code) {
    case 'UNAUTHORIZED':
      // Redirect to login
      window.location.href = '/login';
      break;
      
    case 'VALIDATION_ERROR':
      // Display validation errors
      displayValidationErrors(error.details.errors);
      break;
      
    case 'RATE_LIMIT_EXCEEDED':
      // Show rate limit message and retry
      const retryAfter = error.details.retry_after * 1000;
      setTimeout(() => retryRequest(), retryAfter);
      break;
      
    case 'PLEX_UNREACHABLE':
      // Show Plex connectivity error
      showPlexConnectionError();
      break;
      
    default:
      // Generic error handler
      showGenericError(error.message);
  }
}
```

#### React Error Boundary Example
```jsx
class ApiErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Report error to monitoring service
    reportError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

const ErrorFallback = ({ error }) => {
  if (error.code === 'UNAUTHORIZED') {
    return <LoginPrompt />;
  }
  
  if (error.code === 'ACCESS_DENIED') {
    return <AccessDeniedMessage />;
  }
  
  return <GenericErrorMessage error={error} />;
};
```

### Server-Side Error Patterns

#### Error Creation
```typescript
// Custom error class
class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Usage in controllers
if (!user) {
  throw new AppError(
    'NOT_FOUND',
    'User not found',
    404,
    { userId: requestedUserId }
  );
}

if (requestCount > rateLimit) {
  throw new AppError(
    'RATE_LIMIT_EXCEEDED',
    'Rate limit exceeded. Please wait before making more requests.',
    429,
    {
      limit: rateLimit,
      window: '15 minutes',
      retry_after: retryAfter,
      requests_made: requestCount
    }
  );
}
```

#### Error Middleware
```typescript
const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
  } else {
    // Log unexpected errors
    logger.error('Unexpected error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: {
          error_id: generateErrorId(),
          timestamp: new Date().toISOString()
        }
      }
    });
  }
};
```

## Troubleshooting Guide

### Common Error Scenarios

#### Authentication Issues
1. **Error:** `UNAUTHORIZED` - "Authentication required"
   - **Check:** Cookies are enabled and authentication token exists
   - **Solution:** Re-authenticate using Plex OAuth flow

2. **Error:** `PIN_NOT_AUTHORIZED` - "PIN has not been authorized yet"
   - **Check:** User completed authorization on plex.tv/link
   - **Solution:** Complete Plex authorization or generate new PIN

3. **Error:** `ACCESS_DENIED` - "Insufficient permissions"
   - **Check:** User role and permissions
   - **Solution:** Contact administrator for role elevation

#### Validation Issues
1. **Error:** `VALIDATION_ERROR` - Various validation messages
   - **Check:** Request data format and required fields
   - **Solution:** Review API documentation and fix request data

2. **Error:** `INVALID_INPUT` - "Malformed JSON"
   - **Check:** JSON syntax and structure
   - **Solution:** Validate JSON format and fix syntax errors

#### Service Integration Issues
1. **Error:** `PLEX_UNREACHABLE` - "Cannot connect to Plex server"
   - **Check:** Plex server status and network connectivity
   - **Solution:** Verify Plex server is running and accessible

2. **Error:** `PLEX_TIMEOUT` - "Plex server operation timed out"
   - **Check:** Network speed and Plex server load
   - **Solution:** Wait and retry, or check network connection

3. **Error:** `EXTERNAL_SERVICE_ERROR` - "External service integration failed"
   - **Check:** Service status and API credentials
   - **Solution:** Verify service configuration and credentials

### Debug Information

For development and debugging, additional information may be included in error responses:

```json
{
  "success": false,
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Database operation failed",
    "details": {
      "query": "SELECT * FROM users WHERE id = ?",
      "error": "Connection timeout after 5000ms",
      "timestamp": "2025-01-15T12:00:00.000Z",
      "stack": "Error: Connection timeout..." // Only in development
    }
  }
}
```

**Note:** Stack traces and detailed system information are only included in development environments for security reasons.

### Monitoring and Alerting

MediaNest includes comprehensive error monitoring:
- **Error Tracking**: All errors are logged with correlation IDs
- **Metrics**: Error rates and patterns are monitored
- **Alerting**: Critical errors trigger immediate notifications
- **Dashboards**: Real-time error visibility for administrators

---

## Quick Reference

### Most Common Error Codes

| Code | Status | Description | Action |
|------|--------|-------------|--------|
| `UNAUTHORIZED` | 401 | Authentication required | Log in |
| `ACCESS_DENIED` | 403 | Insufficient permissions | Contact admin |
| `VALIDATION_ERROR` | 400 | Invalid request data | Fix request |
| `NOT_FOUND` | 404 | Resource not found | Check ID |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Wait and retry |
| `PLEX_UNREACHABLE` | 503 | Plex server offline | Check Plex |
| `INTERNAL_ERROR` | 500 | Unexpected error | Retry/contact support |

### Error Response Headers

| Header | Description | Example |
|--------|-------------|---------|
| `X-Error-Code` | Machine-readable error code | `VALIDATION_ERROR` |
| `X-Correlation-ID` | Request correlation ID | `req_abc123xyz` |
| `Retry-After` | Seconds to wait before retry | `300` |
| `X-RateLimit-*` | Rate limiting information | Various |

---

**Last Updated:** January 15, 2025  
**API Version:** 1.0.0  
**Documentation Version:** 1.0.0