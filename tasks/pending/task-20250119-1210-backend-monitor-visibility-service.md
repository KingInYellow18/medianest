# Task: Backend Monitor Visibility Service Implementation

## Task ID

task-20250119-1210-backend-monitor-visibility-service

## Status

- [ ] Not Started
- [ ] In Progress
- [ ] Testing
- [ ] Completed

## Priority

P1 (High)

## Description

Implement the backend service layer for managing monitor visibility settings. This service will handle CRUD operations for monitor visibility, synchronization with Uptime Kuma monitors, and provide filtering logic for role-based access control.

## Acceptance Criteria

### Service Implementation

- [ ] Complete MonitorVisibilityService with all CRUD operations
- [ ] MonitorVisibilityRepository following repository pattern
- [ ] Integration with existing StatusService for filtering
- [ ] Synchronization with Uptime Kuma monitor discovery
- [ ] Proper error handling and validation

### Core Functionality

- [ ] Get all monitors with visibility status (admin view)
- [ ] Get public monitors only (user view)
- [ ] Update single monitor visibility
- [ ] Bulk update multiple monitor visibility
- [ ] Auto-discovery and registration of new monitors
- [ ] Cleanup of removed monitors

### Data Management

- [ ] Automatic sync with Uptime Kuma monitor changes
- [ ] Handle monitor renames and updates
- [ ] Maintain data consistency
- [ ] Efficient caching for frequent queries

## Technical Requirements

### Service Architecture

- MonitorVisibilityService - Business logic layer
- MonitorVisibilityRepository - Data access layer
- Integration with existing StatusService
- Integration with UptimeKumaClient

### Database Operations

- Repository pattern for all database interactions
- Transaction support for bulk operations
- Optimized queries with proper joins
- Caching for frequently accessed data

## Files to Modify/Create

### New Repository

```typescript
// backend/src/repositories/monitor-visibility.repository.ts
import { PrismaService } from '../services/prisma.service';
import { MonitorVisibility, Prisma } from '@prisma/client';

export interface CreateMonitorVisibilityData {
  monitorId: string;
  monitorName: string;
  isPublic?: boolean;
  monitorUrl?: string;
  monitorType?: string;
  updatedBy: number;
}

export interface UpdateMonitorVisibilityData {
  isPublic?: boolean;
  monitorName?: string;
  monitorUrl?: string;
  monitorType?: string;
  updatedBy: number;
}

export interface MonitorVisibilityFilter {
  isPublic?: boolean;
  monitorIds?: string[];
  search?: string;
}

export class MonitorVisibilityRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateMonitorVisibilityData): Promise<MonitorVisibility>;
  async findAll(filter?: MonitorVisibilityFilter): Promise<MonitorVisibility[]>;
  async findByMonitorId(monitorId: string): Promise<MonitorVisibility | null>;
  async findPublicMonitors(): Promise<MonitorVisibility[]>;
  async update(monitorId: string, data: UpdateMonitorVisibilityData): Promise<MonitorVisibility>;
  async updateMany(
    monitorIds: string[],
    data: Partial<UpdateMonitorVisibilityData>,
  ): Promise<number>;
  async delete(monitorId: string): Promise<void>;
  async deleteMany(monitorIds: string[]): Promise<number>;
  async syncWithUptimeKuma(monitors: UptimeKumaMonitor[]): Promise<void>;
}
```

### New Service

```typescript
// backend/src/services/monitor-visibility.service.ts
import { MonitorVisibilityRepository } from '../repositories/monitor-visibility.repository';
import { UptimeKumaService } from './uptime-kuma.service';
import { Logger } from '../utils/logger';

export interface MonitorWithVisibility {
  monitorId: string;
  monitorName: string;
  isPublic: boolean;
  monitorUrl?: string;
  monitorType?: string;
  updatedAt: Date;
  updatedBy?: number;
}

export interface BulkVisibilityUpdate {
  monitorIds: string[];
  isPublic: boolean;
  updatedBy: number;
}

export class MonitorVisibilityService {
  constructor(
    private repository: MonitorVisibilityRepository,
    private uptimeKumaService: UptimeKumaService,
    private logger: Logger,
  ) {}

  async getAllMonitors(userRole: string): Promise<MonitorWithVisibility[]>;
  async getPublicMonitors(): Promise<MonitorWithVisibility[]>;
  async updateMonitorVisibility(
    monitorId: string,
    isPublic: boolean,
    updatedBy: number,
  ): Promise<MonitorWithVisibility>;
  async bulkUpdateVisibility(update: BulkVisibilityUpdate): Promise<number>;
  async syncMonitors(): Promise<void>;
  async discoverNewMonitors(): Promise<MonitorWithVisibility[]>;
  async cleanupRemovedMonitors(): Promise<number>;
}
```

### Updated Status Service

```typescript
// backend/src/services/status.service.ts (modifications)
export class StatusService {
  // ... existing code

  async getFilteredStatuses(userRole: string): Promise<ServiceStatus[]> {
    // Get all statuses
    const allStatuses = await this.getAllStatuses();

    if (userRole === 'ADMIN') {
      return allStatuses;
    }

    // Filter based on monitor visibility for regular users
    const publicMonitors = await this.monitorVisibilityService.getPublicMonitors();
    const publicMonitorIds = new Set(publicMonitors.map((m) => m.monitorId));

    return allStatuses.filter((status) => {
      const monitorId = this.getMonitorIdForService(status.serviceName);
      return !monitorId || publicMonitorIds.has(monitorId);
    });
  }

  private getMonitorIdForService(serviceName: string): string | null {
    // Map service names back to monitor IDs
    for (const [monitorName, mappedService] of this.serviceMapping) {
      if (mappedService === serviceName) {
        return this.getMonitorIdByName(monitorName);
      }
    }
    return null;
  }
}
```

### Updated WebSocket Handler

```typescript
// backend/src/socket/handlers/status.handler.ts (modifications)
export class StatusHandler {
  // ... existing code

  private async broadcastStatusUpdate(status: ServiceStatus): Promise<void> {
    // Get monitor ID for this status
    const monitorId = this.statusService.getMonitorIdForService(status.serviceName);

    if (monitorId) {
      // Check if monitor is public
      const isPublic = await this.monitorVisibilityService.isMonitorPublic(monitorId);

      if (!isPublic) {
        // Only broadcast to admin users
        this.io.to('admin').emit('service:status', status);
        return;
      }
    }

    // Broadcast to all authenticated users
    this.io.to('authenticated').emit('service:status', status);
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
// backend/src/services/__tests__/monitor-visibility.service.test.ts
describe('MonitorVisibilityService', () => {
  describe('getAllMonitors', () => {
    it('should return all monitors for admin users');
    it('should return only public monitors for regular users');
  });

  describe('updateMonitorVisibility', () => {
    it('should update monitor visibility successfully');
    it('should validate monitor exists');
    it('should track who made the update');
  });

  describe('bulkUpdateVisibility', () => {
    it('should update multiple monitors in transaction');
    it('should handle partial failures gracefully');
  });

  describe('syncMonitors', () => {
    it('should discover new monitors from Uptime Kuma');
    it('should update existing monitor metadata');
    it('should cleanup removed monitors');
  });
});
```

### Integration Tests

- Test repository operations with real database
- Test service integration with Uptime Kuma client
- Test filtering logic with StatusService
- Test WebSocket filtering behavior

### Performance Tests

- Bulk operations with large monitor sets
- Query performance with filtering
- Caching effectiveness

## Security Considerations

### Access Control

- Only admins can modify visibility settings
- Proper validation of user permissions
- Audit logging for all changes

### Data Validation

- Validate monitor IDs exist in Uptime Kuma
- Sanitize all input data
- Prevent SQL injection through parameterized queries

## Progress Log

### 2025-01-19 12:10 - Task Created

- Designed service architecture with repository pattern
- Planned integration with existing StatusService
- Created comprehensive interface definitions
- Identified testing requirements and security considerations

## Related Tasks

- Depends on: task-20250119-1205-database-schema-monitor-visibility
- Blocks: task-20250119-1215-admin-api-endpoints
- Related: task-20250119-1220-frontend-admin-interface

## Notes

### Integration Points

1. **StatusService**: Modified to filter based on visibility
2. **UptimeKumaService**: Extended to support monitor discovery
3. **WebSocket Handler**: Updated to respect visibility rules
4. **RBAC Middleware**: Ensures proper permission checking

### Caching Strategy

- Cache public monitor list with Redis (5-minute TTL)
- Invalidate cache when visibility changes
- Use cache for high-frequency dashboard requests

### Sync Strategy

- Periodic sync with Uptime Kuma (every 15 minutes)
- Real-time sync when monitors added/removed
- Graceful handling of Uptime Kuma connectivity issues

### Error Handling

- Graceful degradation when Uptime Kuma unavailable
- Proper error messages for API consumers
- Logging for debugging and monitoring

### Future Enhancements

- Monitor grouping/categorization
- Scheduled visibility changes
- Advanced filtering options
- Monitor metadata caching
