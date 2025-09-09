# Admin API

The MediaNest Admin API provides comprehensive administrative functions for user management, system monitoring, service configuration, and platform oversight.

## Overview

The Admin API is restricted to users with administrative privileges and provides:
- User account management and role assignment
- System-wide statistics and monitoring
- Service management and configuration
- Media request oversight and approval
- Administrative reporting and analytics

**Security Note:** All admin endpoints require both authentication and admin role verification.

## Base Endpoint

```
/api/v1/admin
```

## User Management

### Get All Users

Retrieve a paginated list of all users with optional filtering and sorting.

```http
GET /api/v1/admin/users
```

#### Request

**Headers:**
```
Authorization: Bearer <admin-jwt-token>
```

**Query Parameters:**
```
?page=1&pageSize=20&search=john&role=user&sortBy=createdAt&sortOrder=desc
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `pageSize` | number | No | Users per page (default: 20, max: 100) |
| `search` | string | No | Search by username or email |
| `role` | enum | No | Filter by role (`user`, `admin`, `all`) |
| `sortBy` | enum | No | Sort field (`createdAt`, `lastLoginAt`, `plexUsername`, `email`) |
| `sortOrder` | enum | No | Sort direction (`asc`, `desc`) |

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "user-123",
      "plexUsername": "john_doe",
      "email": "john@example.com",
      "role": "user",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLoginAt": "2024-01-01T12:00:00.000Z",
      "profile": {
        "avatar": "https://plex.tv/users/avatar.png",
        "displayName": "John Doe",
        "country": "US"
      },
      "statistics": {
        "totalRequests": 45,
        "completedRequests": 42,
        "pendingRequests": 2,
        "failedRequests": 1,
        "completionRate": 93.3,
        "averageProcessingTime": "4.2 hours"
      },
      "permissions": {
        "canRequest": true,
        "requestLimit": 50,
        "quotaUsed": 45,
        "quotaResetDate": "2024-02-01T00:00:00.000Z"
      },
      "activity": {
        "lastActivity": "2024-01-01T12:30:00.000Z",
        "sessionsToday": 3,
        "totalSessions": 247
      }
    }
  ],
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "req-admin-users-123",
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 45,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Update User Role

Update a user's role and permissions.

```http
PATCH /api/v1/admin/users/:userId/role
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string (UUID) | Yes | User identifier |

#### Request

**Headers:**
```
Authorization: Bearer <admin-jwt-token>
Content-Type: application/json
```

**Body:**
```json
{
  "role": "admin"
}
```

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "user-123",
    "plexUsername": "john_doe",
    "email": "john@example.com",
    "role": "admin",
    "updatedAt": "2024-01-01T12:30:00.000Z",
    "updatedBy": {
      "id": "admin-456",
      "plexUsername": "admin_user"
    }
  },
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "req-role-update-123"
  }
}
```

### Delete User

Remove a user account from the system.

```http
DELETE /api/v1/admin/users/:userId
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string (UUID) | Yes | User identifier |

#### Request

**Headers:**
```
Authorization: Bearer <admin-jwt-token>
```

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "message": "User deleted successfully",
    "deletedUser": {
      "id": "user-123",
      "plexUsername": "john_doe",
      "email": "john@example.com"
    },
    "deletedAt": "2024-01-01T12:30:00.000Z",
    "deletedBy": {
      "id": "admin-456",
      "plexUsername": "admin_user"
    }
  },
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "req-user-delete-123"
  }
}
```

## Service Management

### Get All Services

Retrieve detailed information about all integrated services and their configurations.

```http
GET /api/v1/admin/services
```

#### Request

**Headers:**
```
Authorization: Bearer <admin-jwt-token>
```

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "services": [
      {
        "id": "plex",
        "name": "Plex Media Server",
        "type": "media_server",
        "status": "active",
        "version": "1.32.7.7621",
        "configuration": {
          "url": "https://plex.example.com:32400",
          "token": "[REDACTED]",
          "machineIdentifier": "abcd1234-efgh-5678-ijkl-9012mnop3456",
          "libraries": [
            {
              "id": "1",
              "title": "Movies",
              "type": "movie",
              "count": 2156
            },
            {
              "id": "2",
              "title": "TV Shows", 
              "type": "show",
              "count": 487
            }
          ]
        },
        "health": {
          "status": "healthy",
          "lastCheck": "2024-01-01T12:30:00.000Z",
          "responseTime": 890,
          "uptime": "15d 8h 32m"
        },
        "metrics": {
          "totalRequests": 15678,
          "successfulRequests": 15234,
          "failedRequests": 444,
          "averageResponseTime": 890
        },
        "permissions": {
          "canModify": true,
          "canDelete": false,
          "requiresRestart": true
        }
      },
      {
        "id": "overseerr",
        "name": "Overseerr",
        "type": "request_manager",
        "status": "active",
        "version": "1.33.2",
        "configuration": {
          "url": "https://overseerr.example.com",
          "apiKey": "[REDACTED]",
          "settings": {
            "autoApprove": false,
            "requestLimit": 50,
            "quotaPeriod": "monthly"
          }
        },
        "health": {
          "status": "healthy",
          "lastCheck": "2024-01-01T12:30:00.000Z",
          "responseTime": 245,
          "uptime": "15d 8h 32m"
        }
      }
    ],
    "summary": {
      "total": 8,
      "active": 7,
      "inactive": 1,
      "healthy": 6,
      "degraded": 1,
      "failed": 0
    }
  },
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "req-admin-services-123"
  }
}
```

## Media Request Administration

### Get All Media Requests

Retrieve all media requests across all users with administrative details.

```http
GET /api/v1/admin/requests
```

#### Request

**Headers:**
```
Authorization: Bearer <admin-jwt-token>
```

**Query Parameters:**
```
?status=pending&user=john_doe&page=1&pageSize=50&sortBy=requestedAt&sortOrder=desc
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | enum | No | Filter by status (`pending`, `approved`, `processing`, `completed`, `failed`) |
| `user` | string | No | Filter by username |
| `page` | number | No | Page number (default: 1) |
| `pageSize` | number | No | Requests per page (default: 20, max: 100) |
| `sortBy` | enum | No | Sort field (`requestedAt`, `updatedAt`, `title`, `status`) |
| `sortOrder` | enum | No | Sort direction (`asc`, `desc`) |

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "request-789",
      "title": "The Matrix",
      "mediaType": "movie",
      "tmdbId": "603",
      "overseerrId": "456",
      "status": "pending",
      "priority": "normal",
      "requestedBy": {
        "id": "user-123",
        "plexUsername": "john_doe",
        "email": "john@example.com"
      },
      "requestedAt": "2024-01-01T10:00:00.000Z",
      "updatedAt": "2024-01-01T10:00:00.000Z",
      "approvedBy": null,
      "approvedAt": null,
      "adminNotes": [],
      "metadata": {
        "poster": "/poster.jpg",
        "overview": "A computer programmer is led to fight an underground war...",
        "releaseDate": "1999-03-31",
        "genres": ["Action", "Science Fiction"],
        "runtime": 136,
        "rating": 8.7
      },
      "processing": {
        "attempts": 0,
        "lastAttempt": null,
        "errorHistory": [],
        "estimatedCompletion": null
      },
      "analytics": {
        "timeInQueue": "2h 30m",
        "userRequestCount": 45,
        "similarRequests": 3
      }
    }
  ],
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "req-admin-requests-123",
    "pagination": {
      "page": 1,
      "pageSize": 50,
      "total": 1847,
      "totalPages": 37,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

## System Statistics

### Get System Statistics

Retrieve comprehensive system statistics and analytics for administrative oversight.

```http
GET /api/v1/admin/stats
```

#### Request

**Headers:**
```
Authorization: Bearer <admin-jwt-token>
```

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 45,
      "activeUsers": {
        "today": 23,
        "thisWeek": 38,
        "thisMonth": 42
      },
      "systemUptime": "15d 8h 32m",
      "version": "2.0.0",
      "lastRestart": "2023-12-17T04:30:00.000Z"
    },
    "userStatistics": {
      "newUsers": {
        "today": 0,
        "thisWeek": 3,
        "thisMonth": 8
      },
      "userActivity": {
        "dailyActiveUsers": 23,
        "weeklyActiveUsers": 38,
        "monthlyActiveUsers": 42
      },
      "userDistribution": {
        "byRole": {
          "admin": 3,
          "user": 42
        },
        "byStatus": {
          "active": 43,
          "inactive": 2
        }
      }
    },
    "requestStatistics": {
      "total": 1847,
      "byStatus": {
        "pending": 12,
        "approved": 8,
        "processing": 3,
        "completed": 1819,
        "failed": 5
      },
      "byTimeframe": {
        "today": 8,
        "thisWeek": 47,
        "thisMonth": 189
      },
      "performance": {
        "averageProcessingTime": "4.2 hours",
        "completionRate": 98.5,
        "approvalRate": 91.2
      },
      "topRequestedContent": [
        {
          "title": "The Office",
          "mediaType": "tv",
          "requests": 23,
          "status": "available"
        },
        {
          "title": "Breaking Bad",
          "mediaType": "tv", 
          "requests": 19,
          "status": "available"
        }
      ]
    },
    "systemResources": {
      "cpu": {
        "usage": 15.6,
        "cores": 16,
        "load": [1.2, 1.8, 2.1],
        "temperature": 58.4
      },
      "memory": {
        "used": 12.8,
        "total": 32.0,
        "available": 19.2,
        "percentage": 40.0,
        "buffers": 2.1,
        "cached": 8.3
      },
      "storage": [
        {
          "mount": "/data/media",
          "used": 41.2,
          "total": 50.0,
          "available": 8.8,
          "percentage": 82.4,
          "filesystem": "ext4",
          "inodes": {
            "used": 1234567,
            "total": 3276800,
            "percentage": 37.7
          }
        }
      ],
      "network": {
        "interfaces": [
          {
            "name": "eth0",
            "bytesIn": 1048576000,
            "bytesOut": 524288000,
            "packetsIn": 1000000,
            "packetsOut": 800000,
            "errors": 0,
            "dropped": 0
          }
        ]
      }
    },
    "serviceHealth": {
      "plex": {
        "status": "healthy",
        "uptime": "12d 15h 22m",
        "responseTime": 890,
        "errorRate": 0.02
      },
      "overseerr": {
        "status": "healthy",
        "uptime": "15d 8h 32m",
        "responseTime": 245,
        "errorRate": 0.01
      },
      "database": {
        "status": "healthy",
        "uptime": "15d 8h 32m",
        "responseTime": 12,
        "connectionPool": {
          "active": 8,
          "idle": 12,
          "max": 100
        }
      }
    },
    "security": {
      "failedLoginAttempts": {
        "today": 3,
        "thisWeek": 12,
        "thisMonth": 45
      },
      "suspiciousActivity": {
        "ipAddresses": [
          {
            "ip": "192.168.1.100",
            "attempts": 5,
            "lastAttempt": "2024-01-01T11:30:00.000Z"
          }
        ],
        "totalIncidents": 7
      },
      "tokenStats": {
        "activeTokens": 23,
        "expiredTokens": 156,
        "revokedTokens": 8
      }
    },
    "performance": {
      "apiMetrics": {
        "requestsPerMinute": 156,
        "averageResponseTime": 245,
        "p95ResponseTime": 890,
        "errorRate": 0.12
      },
      "cacheMetrics": {
        "hitRate": 87.3,
        "missRate": 12.7,
        "evictionRate": 0.8
      }
    }
  },
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "req-admin-stats-123",
    "generatedIn": "234ms"
  }
}
```

## Data Models

### User Account (Admin View)

```typescript
interface AdminUserView {
  id: string;
  plexUsername: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  lastLoginAt: string;
  profile: UserProfile;
  statistics: UserStatistics;
  permissions: UserPermissions;
  activity: UserActivity;
  adminNotes?: AdminNote[];
}

interface UserStatistics {
  totalRequests: number;
  completedRequests: number;
  pendingRequests: number;
  failedRequests: number;
  completionRate: number;
  averageProcessingTime: string;
}

interface UserPermissions {
  canRequest: boolean;
  requestLimit: number;
  quotaUsed: number;
  quotaResetDate: string;
  specialPermissions?: string[];
}

interface AdminNote {
  id: string;
  note: string;
  addedBy: string;
  addedAt: string;
  type: 'info' | 'warning' | 'violation';
}
```

### Service Configuration

```typescript
interface ServiceConfiguration {
  id: string;
  name: string;
  type: 'media_server' | 'request_manager' | 'download_client' | 'notification';
  status: 'active' | 'inactive' | 'error';
  version?: string;
  configuration: Record<string, any>;
  health: ServiceHealth;
  metrics: ServiceMetrics;
  permissions: ServicePermissions;
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: string;
  responseTime: number;
  uptime: string;
  alerts?: ServiceAlert[];
}

interface ServiceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  uptime: number;
}
```

## Administrative Actions

### Bulk User Operations

```javascript
// Bulk role update
async function bulkUpdateUserRoles(userIds, newRole) {
  const updates = userIds.map(userId => 
    fetch(`/api/v1/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${getAdminToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: newRole })
    })
  );
  
  return Promise.allSettled(updates);
}

// Bulk request approval
async function bulkApproveRequests(requestIds) {
  return Promise.all(
    requestIds.map(requestId =>
      fetch(`/api/v1/admin/requests/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAdminToken()}`
        }
      })
    )
  );
}
```

### System Maintenance

```javascript
// System health check
async function performSystemHealthCheck() {
  const response = await fetch('/api/v1/admin/system/health-check', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAdminToken()}`
    }
  });
  
  return response.json();
}

// Clear system caches
async function clearSystemCaches() {
  const response = await fetch('/api/v1/admin/system/clear-cache', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAdminToken()}`
    }
  });
  
  return response.json();
}
```

## Security Considerations

### Admin Authentication

Admin endpoints require:
1. Valid JWT token
2. User role verification (`admin`)
3. Additional CSRF protection for destructive operations
4. Rate limiting (stricter than regular endpoints)

### Audit Logging

All admin operations are logged:
```json
{
  "timestamp": "2024-01-01T12:30:00.000Z",
  "action": "user_role_update",
  "adminUser": "admin-456",
  "targetUser": "user-123", 
  "changes": {
    "role": {
      "from": "user",
      "to": "admin"
    }
  },
  "ipAddress": "192.168.1.50",
  "userAgent": "MediaNest Admin Panel/1.0"
}
```

## Error Handling

### Common Admin Error Codes

| Code | Description | Status |
|------|-------------|---------|
| `INSUFFICIENT_PRIVILEGES` | User lacks admin privileges | 403 |
| `USER_NOT_FOUND` | Target user does not exist | 404 |
| `INVALID_ROLE` | Invalid role assignment | 400 |
| `CANNOT_DELETE_ADMIN` | Cannot delete admin users | 400 |
| `SERVICE_CONFIGURATION_ERROR` | Service config invalid | 400 |
| `SYSTEM_MAINTENANCE_MODE` | System in maintenance | 503 |

## Rate Limiting

Admin endpoints have specific rate limits:

- **User Management**: 30 requests per minute
- **Service Management**: 20 requests per minute  
- **System Statistics**: 60 requests per minute
- **Bulk Operations**: 5 requests per minute

## Best Practices

1. **Principle of Least Privilege**: Only grant admin access when necessary
2. **Audit Trail**: All admin actions are logged and traceable
3. **Two-Factor Authentication**: Recommended for admin accounts
4. **Regular Review**: Periodic review of admin access and permissions
5. **Monitoring**: Monitor admin activity for suspicious behavior