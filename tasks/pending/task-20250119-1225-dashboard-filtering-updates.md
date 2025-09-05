# Task: Dashboard Filtering Updates for Monitor Visibility

## Task ID

task-20250119-1225-dashboard-filtering-updates

## Status

- [ ] Not Started
- [ ] In Progress
- [ ] Testing
- [ ] Completed

## Priority

P1 (High)

## Description

Update the existing dashboard components and service status displays to respect monitor visibility settings. This ensures that regular users only see monitors marked as public, while admins continue to see all monitors, maintaining a seamless user experience without indicating hidden monitors exist.

## Acceptance Criteria

### Dashboard Filtering

- [ ] Service status cards respect visibility settings based on user role
- [ ] Uptime Kuma card shows only public monitors for regular users
- [ ] Admin users see all monitors regardless of visibility setting
- [ ] No visual indication to users that monitors are being filtered
- [ ] Service counts and statistics reflect filtered data

### Component Updates

- [ ] ServiceCard component adapts to filtered service list
- [ ] UptimeKumaCard component shows correct monitor counts
- [ ] Dashboard layout remains consistent regardless of filtering
- [ ] Loading states work correctly with filtered data
- [ ] Error states handle partial service availability

### Real-time Updates

- [ ] WebSocket events respect user role-based filtering
- [ ] Status updates only sent to authorized users
- [ ] Real-time service count updates reflect visibility changes
- [ ] Admin visibility changes immediately affect user dashboards

### API Integration

- [ ] Dashboard API calls include user role information
- [ ] Service status endpoints filter based on user permissions
- [ ] Efficient filtering to avoid performance degradation
- [ ] Proper error handling for filtered services

## Technical Requirements

### Updated Service Status Hook

```typescript
// frontend/src/lib/hooks/useServiceStatus.ts (modifications)
interface UseServiceStatusReturn {
  services: ServiceStatus[];
  loading: boolean;
  error: string | null;
  totalServices: number;
  upServices: number;
  downServices: number;
  degradedServices: number;
  lastUpdated: Date | null;

  // New methods for handling filtered data
  refreshServices: () => Promise<void>;
  isFiltered: boolean; // Indicates if data is filtered based on role
}

export function useServiceStatus(): UseServiceStatusReturn {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // Fetch filtered services based on user role
  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getServiceStatus();
      setServices(response.data);
      setIsFiltered(!isAdmin && response.filtered === true);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  // WebSocket filtering based on user role
  useEffect(() => {
    if (!socket) return;

    const handleStatusUpdate = (status: ServiceStatus) => {
      // Only process updates for services the user can see
      setServices((prev) => {
        const updated = prev.map((service) =>
          service.serviceName === status.serviceName ? status : service,
        );
        return updated;
      });
    };

    socket.on('service:status', handleStatusUpdate);
    return () => socket.off('service:status', handleStatusUpdate);
  }, [socket, isAdmin]);

  // ... rest of the hook implementation
}
```

### Updated Dashboard API

```typescript
// frontend/src/lib/api/dashboard.ts (modifications)
export interface ServiceStatusResponse {
  data: ServiceStatus[];
  filtered?: boolean; // Indicates if response was filtered
  timestamp: string;
  metadata?: {
    totalMonitors: number;
    visibleMonitors: number;
    hiddenMonitors: number;
  };
}

export const dashboardAPI = {
  async getServiceStatus(): Promise<ServiceStatusResponse> {
    const response = await apiClient.get('/dashboard/status');
    return response.data;
  },

  async getSpecificServiceStatus(serviceName: string): Promise<{ data: ServiceStatus }> {
    const response = await apiClient.get(`/dashboard/status/${serviceName}`);
    return response.data;
  },
};
```

### Updated Service Card Component

```typescript
// frontend/src/components/dashboard/cards/ServiceCard.tsx (modifications)
interface ServiceCardProps {
  service: ServiceStatus;
  showUnavailable?: boolean; // New prop to handle filtered services
  onRefresh?: () => void;
}

export function ServiceCard({ service, showUnavailable = false, onRefresh }: ServiceCardProps) {
  // Handle cases where service might be filtered out
  if (!service && !showUnavailable) {
    return null; // Don't render anything if service is not accessible
  }

  // Show placeholder if service is being filtered
  if (!service && showUnavailable) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          <p>Service not available</p>
        </div>
      </Card>
    );
  }

  // ... rest of the component remains the same
}
```

### Updated Uptime Kuma Card

```typescript
// frontend/src/components/dashboard/cards/UptimeKumaCard.tsx (modifications)
interface UptimeKumaCardProps {
  className?: string;
}

export function UptimeKumaCard({ className }: UptimeKumaCardProps) {
  const { services, loading, error, isFiltered } = useServiceStatus();
  const uptimeKumaServices = services.filter(s => s.serviceName === 'uptime-kuma');

  // Calculate monitor statistics from visible services only
  const monitorStats = useMemo(() => {
    const stats = {
      total: 0,
      up: 0,
      down: 0,
      overall_uptime: 0
    };

    // Calculate stats from visible monitors only
    if (uptimeKumaServices.length > 0) {
      const service = uptimeKumaServices[0];
      // Parse monitor data considering filtered results
      stats.total = service.metadata?.visibleMonitors || service.metadata?.totalMonitors || 0;
      stats.up = service.metadata?.upMonitors || 0;
      stats.down = stats.total - stats.up;
      stats.overall_uptime = service.uptimePercentage || 0;
    }

    return stats;
  }, [uptimeKumaServices]);

  return (
    <ServiceCard service={uptimeKumaServices[0]} className={className}>
      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span>Monitored Services:</span>
          <span className="font-medium">{monitorStats.total}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-green-600">Up:</span>
          <span className="font-medium text-green-600">{monitorStats.up}</span>
        </div>

        {monitorStats.down > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-red-600">Down:</span>
            <span className="font-medium text-red-600">{monitorStats.down}</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span>Overall Uptime:</span>
          <span className="font-medium">{monitorStats.overall_uptime.toFixed(1)}%</span>
        </div>

        {/* Don't show filtering indicator to avoid confusion */}
      </div>
    </ServiceCard>
  );
}
```

### WebSocket Event Filtering

```typescript
// frontend/src/lib/hooks/useWebSocket.ts (modifications)
export function useWebSocket() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (!socket || !user) return;

    // Join appropriate room based on user role
    socket.emit('join-room', {
      room: isAdmin ? 'admin' : 'users',
      userId: user.id,
    });

    return () => {
      socket.emit('leave-room', {
        room: isAdmin ? 'admin' : 'users',
        userId: user.id,
      });
    };
  }, [socket, user, isAdmin]);

  // ... rest of WebSocket hook
}
```

## Files to Modify/Create

### Updated Components

- `frontend/src/components/dashboard/cards/ServiceCard.tsx` - Handle filtered services
- `frontend/src/components/dashboard/cards/UptimeKumaCard.tsx` - Show filtered monitor stats
- `frontend/src/components/dashboard/ServiceGrid.tsx` - Layout with filtered services

### Updated Hooks

- `frontend/src/lib/hooks/useServiceStatus.ts` - Role-based filtering
- `frontend/src/lib/hooks/useWebSocket.ts` - Room-based event filtering

### Updated API

- `frontend/src/lib/api/dashboard.ts` - Handle filtered responses

### Backend WebSocket Updates

```typescript
// backend/src/socket/handlers/status.handler.ts (modifications)
export class StatusHandler {
  async handleConnection(socket: Socket, user: User): Promise<void> {
    // Join user to appropriate room based on role
    const room = user.role === 'ADMIN' ? 'admin' : 'users';
    await socket.join(room);
    await socket.join('authenticated');

    // Send initial filtered status based on user role
    const statuses = await this.statusService.getFilteredStatuses(user.role);
    socket.emit('service:status:initial', statuses);
  }

  private async broadcastStatusUpdate(status: ServiceStatus): Promise<void> {
    // Check if this service should be visible to regular users
    const isPublicService = await this.monitorVisibilityService.isServicePublic(status.serviceName);

    if (isPublicService) {
      // Broadcast to all authenticated users
      this.io.to('authenticated').emit('service:status', status);
    } else {
      // Only broadcast to admin users
      this.io.to('admin').emit('service:status', status);
    }
  }
}
```

## Testing Strategy

### Component Tests

```typescript
// frontend/__tests__/components/dashboard/ServiceCard.test.tsx
describe('ServiceCard with Filtering', () => {
  it('should render service card for accessible services');
  it('should not render anything for filtered services');
  it('should handle missing service data gracefully');
  it('should show correct status indicators');
});

// frontend/__tests__/hooks/useServiceStatus.test.ts
describe('useServiceStatus with Filtering', () => {
  it('should fetch all services for admin users');
  it('should fetch only public services for regular users');
  it('should handle filtered WebSocket events correctly');
  it('should calculate correct statistics for filtered data');
});
```

### Integration Tests

```typescript
describe('Dashboard Filtering Integration', () => {
  it('should show different dashboard content based on user role');
  it('should handle real-time updates with proper filtering');
  it('should maintain consistent layout with filtered data');
  it('should not expose hidden service information');
});
```

### E2E Tests

```typescript
// frontend/e2e/dashboard/filtering.spec.ts
describe('Dashboard Filtering E2E', () => {
  it('should show admin all monitors in dashboard');
  it('should show users only public monitors');
  it('should update dashboard when admin changes visibility');
  it('should maintain real-time updates with filtering');
});
```

## Security Considerations

### Client-Side Protection

- Never expose filtered service names or metadata to unauthorized users
- Validate user role before rendering admin-specific content
- Handle API errors that might leak service information
- Clear sensitive data from memory after logout

### Data Leakage Prevention

- Ensure filtered services don't appear in component state
- Prevent caching of unauthorized service data
- Validate all WebSocket events before processing
- Log security violations for monitoring

## Performance Considerations

### Efficient Filtering

- Filter data on server-side to reduce bandwidth
- Cache filtered results appropriately
- Minimize re-renders when filtering changes
- Optimize WebSocket event handling

### User Experience

- Maintain consistent dashboard layout regardless of filtering
- Provide smooth transitions when visibility changes
- Avoid flash of unauthorized content
- Handle loading states gracefully

## Progress Log

### 2025-01-19 12:25 - Task Created

- Analyzed dashboard components requiring updates
- Designed filtering strategy for WebSocket events
- Planned component modifications for seamless UX
- Created comprehensive testing approach

## Related Tasks

- Depends on: task-20250119-1215-admin-api-endpoints
- Depends on: task-20250119-1220-frontend-admin-interface
- Blocks: task-20250119-1230-websocket-filtering
- Related: task-20250119-1235-testing-integration

## Notes

### User Experience Design

- Users should never know that services are being filtered
- Dashboard should feel complete and functional regardless of role
- No empty states or placeholders that hint at hidden content
- Maintain consistent visual hierarchy

### Implementation Strategy

1. **Server-side filtering first** - Ensure data is filtered at the API level
2. **Client-side validation** - Verify user permissions before rendering
3. **WebSocket filtering** - Separate event streams for different user roles
4. **Graceful degradation** - Handle service unavailability smoothly

### Performance Optimization

- Use React.memo for service cards to prevent unnecessary re-renders
- Implement efficient WebSocket event handling
- Cache filtered service lists appropriately
- Debounce real-time updates to prevent UI thrashing

### Future Considerations

- Dashboard customization per user role
- Service grouping and categorization
- Advanced filtering options for admins
- Service health indicators based on visibility
