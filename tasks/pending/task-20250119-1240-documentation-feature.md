# Task: Documentation for Monitor Visibility Feature

## Task ID

task-20250119-1240-documentation-feature

## Status

- [ ] Not Started
- [ ] In Progress
- [ ] Testing
- [ ] Completed

## Priority

P2 (Medium)

## Description

Create comprehensive documentation for the monitor visibility feature, including user guides, admin documentation, API documentation, and technical implementation details. This documentation will help users understand and effectively use the feature while providing developers with the information needed for maintenance and future enhancements.

## Acceptance Criteria

### User Documentation

- [ ] Admin guide for managing monitor visibility
- [ ] User guide explaining dashboard behavior
- [ ] Screenshots and visual guides for key workflows
- [ ] Troubleshooting guide for common issues
- [ ] FAQ addressing typical user questions

### Technical Documentation

- [ ] API documentation with examples and schemas
- [ ] Database schema documentation
- [ ] WebSocket event documentation
- [ ] Architecture overview and design decisions
- [ ] Security implementation details

### Developer Documentation

- [ ] Code documentation and comments
- [ ] Testing guide and examples
- [ ] Deployment considerations
- [ ] Monitoring and observability setup
- [ ] Future enhancement planning

### Integration Documentation

- [ ] Uptime Kuma configuration requirements
- [ ] Environment variable documentation
- [ ] Database migration procedures
- [ ] Rollback procedures and considerations

## Technical Requirements

### Documentation Structure

#### User Documentation

```markdown
docs/features/monitor-visibility/
├── README.md # Feature overview
├── admin-guide.md # Admin management guide
├── user-guide.md # End user guide
├── troubleshooting.md # Common issues and solutions
├── faq.md # Frequently asked questions
└── screenshots/ # Visual aids and examples
├── admin-interface/
├── dashboard-filtering/
└── mobile-views/
```

#### Technical Documentation

```markdown
docs/technical/monitor-visibility/
├── api-reference.md # Complete API documentation
├── database-schema.md # Schema and relationships
├── websocket-events.md # Real-time event documentation
├── architecture.md # System design and patterns
├── security.md # Security implementation
└── performance.md # Performance considerations
```

#### Developer Documentation

```markdown
docs/development/monitor-visibility/
├── setup-guide.md # Development environment setup
├── testing-guide.md # How to run and write tests
├── code-style.md # Coding standards and patterns
├── deployment.md # Deployment procedures
├── monitoring.md # Observability and metrics
└── contributing.md # Contribution guidelines
```

### API Documentation

#### OpenAPI Specification

```yaml
# docs/api/monitor-visibility.openapi.yml
openapi: 3.0.3
info:
  title: MediaNest Monitor Visibility API
  description: API for managing Uptime Kuma monitor visibility settings
  version: 1.0.0

paths:
  /api/admin/monitors:
    get:
      summary: Get all monitors with visibility status
      tags: [Admin, Monitor Visibility]
      security:
        - bearerAuth: []
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            minimum: 1
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 50
        - name: search
          in: query
          schema:
            type: string
        - name: visibility
          in: query
          schema:
            type: string
            enum: [public, admin-only, all]
            default: all
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/MonitorWithVisibility'
                  pagination:
                    $ref: '#/components/schemas/PaginationInfo'

  /api/admin/monitors/{id}/visibility:
    patch:
      summary: Update monitor visibility
      tags: [Admin, Monitor Visibility]
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                isPublic:
                  type: boolean
              required: [isPublic]
      responses:
        '200':
          description: Visibility updated successfully
        '404':
          description: Monitor not found
        '403':
          description: Insufficient permissions

components:
  schemas:
    MonitorWithVisibility:
      type: object
      properties:
        monitorId:
          type: string
        monitorName:
          type: string
        isPublic:
          type: boolean
        monitorUrl:
          type: string
          nullable: true
        monitorType:
          type: string
          nullable: true
        updatedAt:
          type: string
          format: date-time
        updatedBy:
          type: integer
          nullable: true
      required: [monitorId, monitorName, isPublic, updatedAt]

    PaginationInfo:
      type: object
      properties:
        page:
          type: integer
        limit:
          type: integer
        total:
          type: integer
        totalPages:
          type: integer
      required: [page, limit, total, totalPages]

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

### Database Schema Documentation

```markdown
# Database Schema: Monitor Visibility

## Tables

### monitor_visibility

The `monitor_visibility` table stores configuration for which Uptime Kuma monitors are visible to regular users versus admin-only.

| Column       | Type         | Constraints                         | Description                                         |
| ------------ | ------------ | ----------------------------------- | --------------------------------------------------- |
| id           | SERIAL       | PRIMARY KEY                         | Auto-incrementing unique identifier                 |
| monitor_id   | VARCHAR(255) | NOT NULL, UNIQUE                    | Uptime Kuma monitor ID                              |
| monitor_name | VARCHAR(255) | NOT NULL                            | Human-readable monitor name                         |
| is_public    | BOOLEAN      | NOT NULL, DEFAULT FALSE             | Visibility flag (false = admin-only, true = public) |
| monitor_url  | VARCHAR(500) | NULLABLE                            | Monitor target URL                                  |
| monitor_type | VARCHAR(100) | NULLABLE                            | Monitor type (http, ping, etc.)                     |
| created_at   | TIMESTAMP    | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation time                                |
| updated_at   | TIMESTAMP    | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Last update time                                    |
| updated_by   | INTEGER      | NULLABLE, FK to users.id            | User who last updated visibility                    |

## Indexes

- `idx_monitor_visibility_is_public` - For filtering by visibility status
- `idx_monitor_visibility_monitor_id` - For lookups by monitor ID
- `idx_monitor_visibility_updated_at` - For ordering by update time

## Relationships

- `monitor_visibility.updated_by` → `users.id` (SET NULL on delete)

## Security Considerations

- All queries should filter based on user role
- Admin users see all records regardless of `is_public` value
- Regular users only see records where `is_public = true`
- Audit trail maintained through `updated_by` field
```

## Files to Create

### User Documentation

```markdown
<!-- docs/features/monitor-visibility/admin-guide.md -->

# Admin Guide: Monitor Visibility Management

## Overview

The Monitor Visibility feature allows administrators to control which Uptime Kuma monitors are visible to regular users in the MediaNest dashboard. This provides flexibility in showing only user-relevant services while keeping internal or sensitive monitors private.

## Key Concepts

### Visibility Levels

- **Public**: Monitor visible to all authenticated users
- **Admin-Only**: Monitor visible only to administrators

### Default Behavior

- New monitors are set to Admin-Only by default for security
- Administrators must explicitly make monitors public
- Changes take effect immediately across all user sessions

## Managing Monitor Visibility

### Accessing the Monitor Management Interface

1. Log in as an administrator
2. Navigate to Admin Panel → Monitors
3. View the complete list of discovered monitors

### Individual Monitor Management

#### Toggle Visibility

1. Locate the monitor in the list
2. Click the visibility toggle switch
3. Confirm the change in the notification

#### Monitor Information

Each monitor displays:

- Monitor name and type
- Current visibility status
- Target URL (if available)
- Last update time and user

### Bulk Operations

#### Select Multiple Monitors

1. Use checkboxes to select monitors
2. Or click "Select All" for all monitors

#### Bulk Visibility Changes

1. Select desired monitors
2. Click "Make Public" or "Make Private"
3. Confirm the bulk operation
4. Review the results summary

### Monitor Synchronization

#### Automatic Sync

- Monitors are automatically synchronized every 15 minutes
- New monitors are discovered and added as Admin-Only
- Removed monitors are cleaned up automatically

#### Manual Sync

1. Click the "Sync Monitors" button
2. Wait for synchronization to complete
3. Review the sync results:
   - New monitors discovered
   - Existing monitors updated
   - Removed monitors cleaned up

## Best Practices

### Security Considerations

- Keep internal services (databases, APIs) as Admin-Only
- Only make user-facing services public
- Regularly review monitor visibility settings
- Monitor the audit log for changes

### User Experience

- Make essential services public for user awareness
- Consider user needs when setting visibility
- Use descriptive monitor names for clarity

### Maintenance

- Sync monitors after Uptime Kuma configuration changes
- Review new monitors after adding services
- Clean up unused monitor configurations

## Troubleshooting

### Common Issues

#### Monitor Not Appearing

1. Check if Uptime Kuma is accessible
2. Verify monitor is active in Uptime Kuma
3. Try manual sync operation
4. Check application logs

#### Visibility Changes Not Reflected

1. Refresh the browser page
2. Check WebSocket connection status
3. Verify user role permissions
4. Review error notifications

#### Sync Failures

1. Verify Uptime Kuma connectivity
2. Check authentication credentials
3. Review Uptime Kuma service status
4. Examine application logs for errors

For additional support, contact the system administrator or check the application logs.
```

### API Documentation

````markdown
<!-- docs/technical/monitor-visibility/api-reference.md -->

# Monitor Visibility API Reference

## Authentication

All Monitor Visibility API endpoints require authentication via JWT token in the Authorization header:

```http
Authorization: Bearer <jwt-token>
```
````

Admin endpoints additionally require the user to have the `ADMIN` role.

## Endpoints

### List Monitors

Retrieve a paginated list of all monitors with their visibility status.

**Endpoint:** `GET /api/admin/monitors`  
**Authorization:** Admin required  
**Rate Limit:** 100 requests/minute

#### Query Parameters

| Parameter  | Type    | Default | Description                                         |
| ---------- | ------- | ------- | --------------------------------------------------- |
| page       | integer | 1       | Page number for pagination                          |
| limit      | integer | 50      | Number of results per page (max 100)                |
| search     | string  | -       | Search term for monitor names                       |
| visibility | enum    | all     | Filter by visibility: 'public', 'admin-only', 'all' |
| sort       | enum    | name    | Sort field: 'name', 'updated_at', 'visibility'      |
| order      | enum    | asc     | Sort order: 'asc', 'desc'                           |

#### Example Request

```http
GET /api/admin/monitors?page=1&limit=25&search=plex&visibility=public&sort=name&order=asc
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Example Response

```json
{
  "data": [
    {
      "monitorId": "1",
      "monitorName": "Plex Media Server",
      "isPublic": true,
      "monitorUrl": "https://plex.example.com",
      "monitorType": "http",
      "updatedAt": "2025-01-19T12:00:00Z",
      "updatedBy": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
  }
}
```

### Update Monitor Visibility

Update the visibility setting for a single monitor.

**Endpoint:** `PATCH /api/admin/monitors/{id}/visibility`  
**Authorization:** Admin required  
**Rate Limit:** 20 requests/minute

#### Path Parameters

| Parameter | Type   | Description                 |
| --------- | ------ | --------------------------- |
| id        | string | Monitor ID from Uptime Kuma |

#### Request Body

```json
{
  "isPublic": boolean
}
```

#### Example Request

```http
PATCH /api/admin/monitors/1/visibility
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "isPublic": false
}
```

#### Example Response

```json
{
  "data": {
    "monitorId": "1",
    "monitorName": "Plex Media Server",
    "isPublic": false,
    "monitorUrl": "https://plex.example.com",
    "monitorType": "http",
    "updatedAt": "2025-01-19T12:30:00Z",
    "updatedBy": 1
  },
  "message": "Monitor visibility updated successfully"
}
```

### Bulk Update Visibility

Update visibility for multiple monitors in a single operation.

**Endpoint:** `PATCH /api/admin/monitors/bulk-visibility`  
**Authorization:** Admin required  
**Rate Limit:** 10 requests/minute

#### Request Body

```json
{
  "monitorIds": ["1", "2", "3"],
  "isPublic": boolean
}
```

#### Example Response

```json
{
  "data": {
    "updated": 3,
    "failed": []
  },
  "message": "Updated visibility for 3 monitors"
}
```

### Sync Monitors

Trigger synchronization with Uptime Kuma to discover new monitors and update existing ones.

**Endpoint:** `POST /api/admin/monitors/sync`  
**Authorization:** Admin required  
**Rate Limit:** 5 requests/minute

#### Example Response

```json
{
  "data": {
    "discovered": 2,
    "updated": 1,
    "removed": 0,
    "newMonitors": [
      {
        "monitorId": "4",
        "monitorName": "New Service",
        "isPublic": false,
        "monitorType": "http",
        "updatedAt": "2025-01-19T12:45:00Z"
      }
    ]
  },
  "message": "Monitor synchronization completed"
}
```

## Error Responses

### Standard Error Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional error details"
    }
  },
  "timestamp": "2025-01-19T12:00:00Z"
}
```

### Common Error Codes

| Status | Code                | Description                       |
| ------ | ------------------- | --------------------------------- |
| 400    | VALIDATION_ERROR    | Invalid request data              |
| 401    | UNAUTHORIZED        | Missing or invalid authentication |
| 403    | FORBIDDEN           | Insufficient permissions          |
| 404    | MONITOR_NOT_FOUND   | Monitor ID does not exist         |
| 429    | RATE_LIMIT_EXCEEDED | Too many requests                 |
| 500    | INTERNAL_ERROR      | Server error                      |

````

### WebSocket Events Documentation
```markdown
<!-- docs/technical/monitor-visibility/websocket-events.md -->
# WebSocket Events: Monitor Visibility

## Connection and Authentication

WebSocket connections require JWT authentication via the auth parameter:

```javascript
const socket = io('ws://localhost:4000', {
  auth: {
    token: 'your-jwt-token'
  }
});
````

## Room Assignment

Users are automatically assigned to rooms based on their role:

- `authenticated` - All authenticated users
- `admin` - Admin users only
- `users` - Regular users only
- `user:{userId}` - User-specific room

## Events

### Server to Client Events

#### service:status:initial

Sent when client connects, providing initial filtered service status.

**Room:** Based on user role  
**Payload:**

```json
{
  "statuses": [ServiceStatus],
  "timestamp": "2025-01-19T12:00:00Z",
  "filtered": boolean
}
```

#### service:status

Real-time service status updates, filtered by monitor visibility.

**Room:** Based on monitor visibility  
**Payload:**

```json
{
  "serviceName": "plex",
  "status": "up",
  "responseTimeMs": 150,
  "lastCheckAt": "2025-01-19T12:00:00Z",
  "uptimePercentage": 99.9
}
```

#### service:removed

Sent to users when a monitor becomes admin-only.

**Room:** `users`  
**Payload:**

```json
{
  "serviceName": "internal-api",
  "reason": "visibility_changed"
}
```

#### monitor:visibility:changed (Admin Only)

Notifies admins when monitor visibility changes.

**Room:** `admin`  
**Payload:**

```json
{
  "monitorId": "1",
  "monitorName": "Plex Media Server",
  "isPublic": false,
  "serviceName": "plex"
}
```

### Client to Server Events

#### service:status:refresh

Request fresh service status data.

**Payload:** None

#### service:subscribe

Subscribe to updates for a specific service (with permission check).

**Payload:**

```json
{
  "serviceName": "plex"
}
```

#### service:unsubscribe

Unsubscribe from service updates.

**Payload:**

```json
{
  "serviceName": "plex"
}
```

## Error Handling

### Connection Errors

```javascript
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
});
```

### Authentication Errors

```javascript
socket.on('auth_error', (error) => {
  console.error('Authentication failed:', error.message);
  // Redirect to login
});
```

### Permission Errors

```javascript
socket.on('service:subscription:denied', (data) => {
  console.warn('Access denied to service:', data.serviceName);
});
```

```

## Testing Strategy

### Documentation Testing
- [ ] Verify all code examples work correctly
- [ ] Test API documentation against actual endpoints
- [ ] Validate schema examples with real data
- [ ] Check all links and references

### User Testing
- [ ] Have non-technical users follow the guides
- [ ] Gather feedback on clarity and completeness
- [ ] Test troubleshooting procedures
- [ ] Validate setup instructions

### Maintenance
- [ ] Set up automated documentation generation where possible
- [ ] Create documentation update procedures
- [ ] Establish review process for technical accuracy
- [ ] Plan regular documentation updates

## Progress Log

### 2025-01-19 12:40 - Task Created
- Outlined comprehensive documentation structure
- Created detailed API documentation with examples
- Planned user guides and technical references
- Defined testing and maintenance procedures

## Related Tasks
- Depends on: All monitor visibility implementation tasks
- Blocks: User training and feature rollout
- Related: Testing and deployment tasks

## Notes

### Documentation Philosophy
- **User-Centric**: Start with user needs and workflows
- **Example-Rich**: Provide practical examples for all concepts
- **Maintainable**: Structure for easy updates and automation
- **Accessible**: Clear language and multiple formats

### Maintenance Strategy
- Link documentation to code where possible
- Use automated tools for API documentation
- Regular reviews with feature updates
- User feedback integration process

### Future Enhancements
- Interactive API documentation with try-it features
- Video tutorials for complex workflows
- Multi-language support if needed
- Integration with help desk systems
```
