# Task: Admin API Endpoints for Monitor Visibility Control

## Task ID

task-20250119-1215-admin-api-endpoints

## Status

- [ ] Not Started
- [ ] In Progress
- [ ] Testing
- [ ] Completed

## Priority

P1 (High)

## Description

Implement RESTful API endpoints for admin management of monitor visibility settings. These endpoints will provide full CRUD operations for monitor visibility, bulk operations, and integration with the existing admin API structure.

## Acceptance Criteria

### API Endpoints

- [ ] GET /api/admin/monitors - List all monitors with visibility status
- [ ] PATCH /api/admin/monitors/:id/visibility - Update single monitor visibility
- [ ] PATCH /api/admin/monitors/bulk-visibility - Bulk update monitor visibility
- [ ] POST /api/admin/monitors/sync - Trigger monitor sync with Uptime Kuma
- [ ] GET /api/dashboard/status - Modified to respect user role filtering

### Request/Response Format

- [ ] Consistent JSON API format with existing admin endpoints
- [ ] Proper HTTP status codes and error responses
- [ ] Input validation with detailed error messages
- [ ] Pagination support for large monitor lists

### Security & Authentication

- [ ] Admin role required for visibility management endpoints
- [ ] Rate limiting on modification endpoints
- [ ] Input sanitization and validation
- [ ] Proper CORS handling

### Performance

- [ ] Efficient database queries with proper joins
- [ ] Caching for frequently accessed data
- [ ] Optimized bulk operations
- [ ] Response time under 200ms for list operations

## Technical Requirements

### API Specification

#### GET /api/admin/monitors

```typescript
// Query Parameters
interface GetMonitorsQuery {
  page?: number; // Default: 1
  limit?: number; // Default: 50, Max: 100
  search?: string; // Search monitor names
  visibility?: 'public' | 'admin-only' | 'all'; // Default: 'all'
  sort?: 'name' | 'updated_at' | 'visibility'; // Default: 'name'
  order?: 'asc' | 'desc'; // Default: 'asc'
}

// Response
interface GetMonitorsResponse {
  data: MonitorWithVisibility[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

#### PATCH /api/admin/monitors/:id/visibility

```typescript
// Request Body
interface UpdateMonitorVisibilityRequest {
  isPublic: boolean;
}

// Response
interface UpdateMonitorVisibilityResponse {
  data: MonitorWithVisibility;
  message: string;
}
```

#### PATCH /api/admin/monitors/bulk-visibility

```typescript
// Request Body
interface BulkUpdateVisibilityRequest {
  monitorIds: string[];
  isPublic: boolean;
}

// Response
interface BulkUpdateVisibilityResponse {
  data: {
    updated: number;
    failed: string[];
  };
  message: string;
}
```

#### POST /api/admin/monitors/sync

```typescript
// Response
interface SyncMonitorsResponse {
  data: {
    discovered: number;
    updated: number;
    removed: number;
    newMonitors: MonitorWithVisibility[];
  };
  message: string;
}
```

## Files to Modify/Create

### Controller Implementation

```typescript
// backend/src/controllers/admin.controller.ts (additions)
export class AdminController {
  constructor(
    // ... existing dependencies
    private monitorVisibilityService: MonitorVisibilityService,
  ) {}

  // GET /api/admin/monitors
  async getMonitors(req: Request, res: Response): Promise<void> {
    const query = this.validateGetMonitorsQuery(req.query);
    const result = await this.monitorVisibilityService.getMonitorsPaginated(query);

    res.json({
      data: result.data,
      pagination: result.pagination,
    });
  }

  // PATCH /api/admin/monitors/:id/visibility
  async updateMonitorVisibility(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { isPublic } = this.validateUpdateVisibilityRequest(req.body);
    const userId = req.user!.id;

    const monitor = await this.monitorVisibilityService.updateMonitorVisibility(
      id,
      isPublic,
      userId,
    );

    res.json({
      data: monitor,
      message: 'Monitor visibility updated successfully',
    });
  }

  // PATCH /api/admin/monitors/bulk-visibility
  async bulkUpdateMonitorVisibility(req: Request, res: Response): Promise<void> {
    const { monitorIds, isPublic } = this.validateBulkUpdateRequest(req.body);
    const userId = req.user!.id;

    const result = await this.monitorVisibilityService.bulkUpdateVisibility({
      monitorIds,
      isPublic,
      updatedBy: userId,
    });

    res.json({
      data: result,
      message: `Updated visibility for ${result.updated} monitors`,
    });
  }

  // POST /api/admin/monitors/sync
  async syncMonitors(req: Request, res: Response): Promise<void> {
    const result = await this.monitorVisibilityService.syncMonitors();

    res.json({
      data: result,
      message: 'Monitor synchronization completed',
    });
  }
}
```

### Dashboard Controller Updates

```typescript
// backend/src/controllers/dashboard.controller.ts (modifications)
export class DashboardController {
  // Modified GET /api/dashboard/status
  async getServiceStatus(req: Request, res: Response): Promise<void> {
    const userRole = req.user?.role || 'USER';
    const statuses = await this.statusService.getFilteredStatuses(userRole);

    res.json({
      data: statuses,
      timestamp: new Date().toISOString(),
    });
  }

  // Modified GET /api/dashboard/status/:service
  async getSpecificServiceStatus(req: Request, res: Response): Promise<void> {
    const { service } = req.params;
    const userRole = req.user?.role || 'USER';

    // Check if user can access this specific service
    const hasAccess = await this.statusService.canAccessService(service, userRole);
    if (!hasAccess) {
      throw new ForbiddenError('Access denied to this service');
    }

    const status = await this.statusService.getServiceStatus(service);
    res.json({ data: status });
  }
}
```

### Validation Schemas

```typescript
// backend/src/validations/monitor-visibility.validation.ts
import { z } from 'zod';

export const getMonitorsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().trim().optional(),
  visibility: z.enum(['public', 'admin-only', 'all']).default('all'),
  sort: z.enum(['name', 'updated_at', 'visibility']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const updateMonitorVisibilitySchema = z.object({
  isPublic: z.boolean(),
});

export const bulkUpdateVisibilitySchema = z.object({
  monitorIds: z.array(z.string().min(1)).min(1).max(50),
  isPublic: z.boolean(),
});

export type GetMonitorsQuery = z.infer<typeof getMonitorsQuerySchema>;
export type UpdateMonitorVisibilityRequest = z.infer<typeof updateMonitorVisibilitySchema>;
export type BulkUpdateVisibilityRequest = z.infer<typeof bulkUpdateVisibilitySchema>;
```

### Route Configuration

```typescript
// backend/src/routes/v1/admin.ts (additions)
// Monitor visibility management routes
router.get('/monitors', requireAdmin, adminController.getMonitors.bind(adminController));
router.patch(
  '/monitors/:id/visibility',
  requireAdmin,
  adminController.updateMonitorVisibility.bind(adminController),
);
router.patch(
  '/monitors/bulk-visibility',
  requireAdmin,
  adminController.bulkUpdateMonitorVisibility.bind(adminController),
);
router.post('/monitors/sync', requireAdmin, adminController.syncMonitors.bind(adminController));
```

### Error Handling

```typescript
// backend/src/middleware/error-handler.ts (additions)
export class MonitorVisibilityError extends AppError {
  constructor(message: string, statusCode: number = 400) {
    super(message, statusCode, 'MONITOR_VISIBILITY_ERROR');
  }
}

export class MonitorNotFoundError extends MonitorVisibilityError {
  constructor(monitorId: string) {
    super(`Monitor with ID '${monitorId}' not found`, 404);
  }
}

export class MonitorSyncError extends MonitorVisibilityError {
  constructor(message: string) {
    super(`Monitor synchronization failed: ${message}`, 500);
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
// backend/src/controllers/__tests__/admin.controller.test.ts
describe('AdminController - Monitor Visibility', () => {
  describe('GET /api/admin/monitors', () => {
    it('should return paginated monitors for admin');
    it('should filter monitors by search query');
    it('should filter monitors by visibility status');
    it('should sort monitors correctly');
    it('should validate pagination parameters');
  });

  describe('PATCH /api/admin/monitors/:id/visibility', () => {
    it('should update monitor visibility successfully');
    it('should return 404 for non-existent monitor');
    it('should validate request body');
    it('should require admin role');
  });

  describe('PATCH /api/admin/monitors/bulk-visibility', () => {
    it('should update multiple monitors successfully');
    it('should handle partial failures gracefully');
    it('should validate monitor IDs');
    it('should limit bulk operation size');
  });

  describe('POST /api/admin/monitors/sync', () => {
    it('should sync monitors successfully');
    it('should handle Uptime Kuma connection issues');
    it('should return sync statistics');
  });
});
```

### Integration Tests

```typescript
describe('Monitor Visibility API Integration', () => {
  describe('Admin workflow', () => {
    it('should allow admin to manage monitor visibility end-to-end');
    it('should sync new monitors and update visibility');
    it('should perform bulk operations correctly');
  });

  describe('User access control', () => {
    it('should deny regular users access to admin endpoints');
    it('should filter dashboard status based on visibility');
    it('should handle role changes correctly');
  });
});
```

### API Testing

- OpenAPI/Swagger documentation
- Postman collection for manual testing
- Load testing for bulk operations
- Rate limiting validation

## Security Considerations

### Authentication & Authorization

- Require admin role for all visibility management endpoints
- Validate JWT tokens on every request
- Rate limiting: 100 requests/minute for list, 20/minute for modifications

### Input Validation

- Sanitize all query parameters and request bodies
- Validate monitor IDs against allowed patterns
- Limit bulk operation sizes to prevent abuse

### Data Protection

- Don't expose sensitive monitor URLs to unauthorized users
- Log all admin actions for audit trail
- Encrypt sensitive data in transit and at rest

## Progress Log

### 2025-01-19 12:15 - Task Created

- Designed comprehensive API specification
- Created validation schemas with Zod
- Planned error handling and security measures
- Defined testing strategy for all endpoints

## Related Tasks

- Depends on: task-20250119-1210-backend-monitor-visibility-service
- Blocks: task-20250119-1220-frontend-admin-interface
- Related: task-20250119-1225-dashboard-filtering-updates

## Notes

### API Design Decisions

1. **RESTful Design**: Following existing admin API patterns
2. **Pagination**: Required for scalability with large monitor lists
3. **Bulk Operations**: Efficient for managing many monitors
4. **Sync Endpoint**: Manual trigger for immediate Uptime Kuma sync
5. **Filtering**: Multiple filter options for admin convenience

### Rate Limiting Strategy

- Higher limits for read operations
- Lower limits for write operations
- IP-based limiting for additional security

### Response Format

- Consistent with existing API responses
- Include metadata for pagination and operations
- Detailed error messages for debugging

### Performance Optimizations

- Database query optimization with proper indexes
- Caching for frequently accessed monitor lists
- Efficient bulk operations with transactions

### Future Enhancements

- Export monitor configurations
- Import monitor visibility settings
- Advanced search and filtering options
- Monitor grouping/categorization support
