# Task: Frontend Admin Interface for Monitor Visibility Management

## Task ID

task-20250119-1220-frontend-admin-interface

## Status

- [ ] Not Started
- [ ] In Progress
- [ ] Testing
- [ ] Completed

## Priority

P1 (High)

## Description

Create a comprehensive admin interface for managing Uptime Kuma monitor visibility settings. This interface will provide intuitive controls for admins to toggle monitor visibility, perform bulk operations, and sync with Uptime Kuma, following MediaNest's design patterns and responsive design principles.

## Acceptance Criteria

### Admin Interface Components

- [ ] Monitor visibility management page accessible from admin panel
- [ ] Data table with monitor list, status, and visibility controls
- [ ] Individual toggle switches for quick visibility changes
- [ ] Bulk selection and operations for multiple monitors
- [ ] Search and filtering capabilities
- [ ] Real-time sync with Uptime Kuma button

### User Experience

- [ ] Responsive design for desktop, tablet, and mobile
- [ ] Loading states and optimistic updates
- [ ] Clear success/error notifications
- [ ] Confirmation dialogs for bulk operations
- [ ] Intuitive navigation within admin panel

### Real-time Features

- [ ] WebSocket integration for live monitor updates
- [ ] Real-time visibility change reflection
- [ ] Live sync status updates
- [ ] Automatic refresh when monitors change

### Performance

- [ ] Virtualized list for large monitor counts
- [ ] Efficient re-renders with React optimization
- [ ] Debounced search functionality
- [ ] Lazy loading for monitor metadata

## Technical Requirements

### Component Architecture

#### Main Page Component

```typescript
// frontend/src/app/(auth)/admin/monitors/page.tsx
'use client';

import React from 'react';
import { MonitorVisibilityManagement } from '@/components/admin/MonitorVisibilityManagement';
import { AdminLayout } from '@/components/admin/AdminLayout';

export default function MonitorsPage() {
  return (
    <AdminLayout title="Monitor Visibility">
      <MonitorVisibilityManagement />
    </AdminLayout>
  );
}
```

#### Management Component

```typescript
// frontend/src/components/admin/MonitorVisibilityManagement.tsx
interface MonitorVisibilityManagementProps {
  className?: string;
}

export function MonitorVisibilityManagement({ className }: MonitorVisibilityManagementProps) {
  // Component implementation
}
```

#### Data Table Component

```typescript
// frontend/src/components/admin/MonitorVisibilityTable.tsx
interface MonitorVisibilityTableProps {
  monitors: MonitorWithVisibility[];
  loading: boolean;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onVisibilityToggle: (monitorId: string, isPublic: boolean) => void;
  onSort: (field: string, direction: 'asc' | 'desc') => void;
}

export function MonitorVisibilityTable(props: MonitorVisibilityTableProps) {
  // Table implementation with sorting, selection, and inline editing
}
```

#### Bulk Actions Component

```typescript
// frontend/src/components/admin/MonitorVisibilityBulkActions.tsx
interface BulkActionsProps {
  selectedCount: number;
  onMakePublic: () => void;
  onMakePrivate: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  disabled?: boolean;
}

export function MonitorVisibilityBulkActions(props: BulkActionsProps) {
  // Bulk operations UI
}
```

#### Toggle Component

```typescript
// frontend/src/components/admin/MonitorVisibilityToggle.tsx
interface MonitorVisibilityToggleProps {
  monitorId: string;
  isPublic: boolean;
  disabled?: boolean;
  onChange: (monitorId: string, isPublic: boolean) => void;
}

export function MonitorVisibilityToggle(props: MonitorVisibilityToggleProps) {
  // Individual toggle switch with optimistic updates
}
```

### Custom Hooks

#### Monitor Visibility Management Hook

```typescript
// frontend/src/lib/hooks/useMonitorVisibility.ts
interface UseMonitorVisibilityReturn {
  monitors: MonitorWithVisibility[];
  loading: boolean;
  error: string | null;
  pagination: PaginationInfo;
  selectedIds: string[];
  searchQuery: string;
  sortConfig: SortConfig;

  // Actions
  updateVisibility: (monitorId: string, isPublic: boolean) => Promise<void>;
  bulkUpdateVisibility: (monitorIds: string[], isPublic: boolean) => Promise<void>;
  syncMonitors: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSort: (field: string, direction: 'asc' | 'desc') => void;
  setSelectedIds: (ids: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;
  loadMore: () => void;
}

export function useMonitorVisibility(): UseMonitorVisibilityReturn {
  // Hook implementation with optimistic updates, caching, and error handling
}
```

#### Real-time Updates Hook

```typescript
// frontend/src/lib/hooks/useMonitorUpdates.ts
interface UseMonitorUpdatesProps {
  onMonitorAdded: (monitor: MonitorWithVisibility) => void;
  onMonitorUpdated: (monitor: MonitorWithVisibility) => void;
  onMonitorRemoved: (monitorId: string) => void;
  onSyncStarted: () => void;
  onSyncCompleted: (stats: SyncStats) => void;
}

export function useMonitorUpdates(props: UseMonitorUpdatesProps) {
  // WebSocket integration for real-time monitor updates
}
```

### API Client Functions

```typescript
// frontend/src/lib/api/admin.ts (additions)
export interface MonitorVisibilityAPI {
  getMonitors: (params: GetMonitorsParams) => Promise<GetMonitorsResponse>;
  updateMonitorVisibility: (monitorId: string, isPublic: boolean) => Promise<MonitorWithVisibility>;
  bulkUpdateVisibility: (request: BulkUpdateRequest) => Promise<BulkUpdateResponse>;
  syncMonitors: () => Promise<SyncResponse>;
}

export const monitorVisibilityAPI: MonitorVisibilityAPI = {
  async getMonitors(params) {
    const response = await apiClient.get('/admin/monitors', { params });
    return response.data;
  },

  async updateMonitorVisibility(monitorId, isPublic) {
    const response = await apiClient.patch(`/admin/monitors/${monitorId}/visibility`, {
      isPublic,
    });
    return response.data.data;
  },

  async bulkUpdateVisibility(request) {
    const response = await apiClient.patch('/admin/monitors/bulk-visibility', request);
    return response.data;
  },

  async syncMonitors() {
    const response = await apiClient.post('/admin/monitors/sync');
    return response.data;
  },
};
```

## Files to Modify/Create

### New Components

- `frontend/src/components/admin/MonitorVisibilityManagement.tsx` - Main management interface
- `frontend/src/components/admin/MonitorVisibilityTable.tsx` - Data table with sorting/filtering
- `frontend/src/components/admin/MonitorVisibilityToggle.tsx` - Individual toggle control
- `frontend/src/components/admin/MonitorVisibilityBulkActions.tsx` - Bulk operations toolbar
- `frontend/src/components/admin/MonitorSyncButton.tsx` - Sync trigger with status

### New Pages

- `frontend/src/app/(auth)/admin/monitors/page.tsx` - Admin monitors page

### New Hooks

- `frontend/src/lib/hooks/useMonitorVisibility.ts` - Main management hook
- `frontend/src/lib/hooks/useMonitorUpdates.ts` - Real-time updates hook

### API Updates

- `frontend/src/lib/api/admin.ts` - Add monitor visibility API functions

### Navigation Updates

- `frontend/src/components/admin/AdminSidebar.tsx` - Add monitors navigation item

### Type Definitions

```typescript
// frontend/src/types/admin.ts (additions)
export interface MonitorWithVisibility {
  monitorId: string;
  monitorName: string;
  isPublic: boolean;
  monitorUrl?: string;
  monitorType?: string;
  updatedAt: string;
  updatedBy?: number;
}

export interface GetMonitorsParams {
  page?: number;
  limit?: number;
  search?: string;
  visibility?: 'public' | 'admin-only' | 'all';
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface SyncStats {
  discovered: number;
  updated: number;
  removed: number;
  newMonitors: MonitorWithVisibility[];
}
```

## UI/UX Design Specifications

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Monitor Visibility Management                                │
├─────────────────────────────────────────────────────────────┤
│ [Search Box] [Filter Dropdown] [Sync Button] [Bulk Actions] │
├─────────────────────────────────────────────────────────────┤
│ ┌─┐ Monitor Name          Type      URL            Visibility│
│ │☐│ Plex Media Server    HTTP      plex.local     [●] Public │
│ │☐│ Overseerr            HTTP      over.local     [○] Private│
│ │☐│ Uptime Kuma         HTTP      kuma.local     [●] Public │
│ │☐│ Internal API         HTTP      api.internal   [○] Private│
├─────────────────────────────────────────────────────────────┤
│ Selected: 0 | Total: 4 monitors    [← Prev] [Next →]        │
└─────────────────────────────────────────────────────────────┘
```

### Visual Design Elements

- **Toggle Switches**: Custom styled toggle switches with clear on/off states
- **Status Indicators**: Color-coded visibility status (green = public, gray = private)
- **Bulk Actions**: Floating action bar when items selected
- **Loading States**: Skeleton loaders for table rows
- **Success/Error Feedback**: Toast notifications for actions

### Responsive Breakpoints

- **Desktop (≥1024px)**: Full table with all columns
- **Tablet (768-1023px)**: Simplified table, some columns hidden
- **Mobile (≤767px)**: Card-based layout with stacked information

## Testing Strategy

### Component Tests

```typescript
// frontend/__tests__/components/admin/MonitorVisibilityManagement.test.tsx
describe('MonitorVisibilityManagement', () => {
  it('should render monitor list correctly');
  it('should handle visibility toggle');
  it('should perform bulk operations');
  it('should filter and search monitors');
  it('should handle loading and error states');
});

// frontend/__tests__/hooks/useMonitorVisibility.test.ts
describe('useMonitorVisibility', () => {
  it('should fetch monitors on mount');
  it('should update visibility optimistically');
  it('should handle bulk updates');
  it('should manage selection state');
  it('should handle API errors gracefully');
});
```

### Integration Tests

- Full admin workflow from login to monitor management
- Real-time updates via WebSocket
- Responsive design across breakpoints
- Accessibility compliance testing

### E2E Tests

```typescript
// frontend/e2e/admin/monitor-visibility.spec.ts
describe('Monitor Visibility Management', () => {
  it('should allow admin to toggle monitor visibility');
  it('should perform bulk visibility changes');
  it('should sync monitors with Uptime Kuma');
  it('should show real-time updates');
  it('should prevent unauthorized access');
});
```

## Security Considerations

### Client-Side Security

- Verify admin role before rendering admin components
- Validate all user inputs before API calls
- Handle authentication errors gracefully
- Prevent unauthorized route access

### Data Protection

- Don't cache sensitive monitor data in localStorage
- Clear sensitive data on logout
- Validate server responses before processing

## Performance Optimization

### React Optimization

- Use React.memo for expensive components
- Implement virtual scrolling for large lists
- Debounce search input (300ms)
- Optimize re-renders with useCallback/useMemo

### Data Management

- Cache monitor list with SWR/React Query
- Implement optimistic updates for better UX
- Batch API calls where possible
- Use pagination for large datasets

## Progress Log

### 2025-01-19 12:20 - Task Created

- Designed comprehensive admin interface components
- Created custom hooks for state management
- Planned responsive design and accessibility
- Defined testing strategy and performance optimizations

## Related Tasks

- Depends on: task-20250119-1215-admin-api-endpoints
- Blocks: task-20250119-1225-dashboard-filtering-updates
- Related: task-20250119-1230-websocket-filtering

## Notes

### Design System Integration

- Follow existing MediaNest admin panel design patterns
- Use consistent color scheme and typography
- Implement dark mode support
- Maintain accessibility standards (WCAG 2.1 AA)

### User Experience Considerations

- Clear visual feedback for all actions
- Undo functionality for accidental changes
- Keyboard navigation support
- Screen reader compatibility

### Technical Decisions

1. **State Management**: Custom hooks with React Query for server state
2. **UI Framework**: Continue with Tailwind CSS for consistency
3. **Table Implementation**: Custom table vs existing library (decision: custom for flexibility)
4. **Real-time Updates**: WebSocket integration for live updates
5. **Optimistic Updates**: Immediate UI updates with rollback on failure

### Future Enhancements

- Export/import monitor configurations
- Monitor grouping and categorization
- Advanced filtering and sorting options
- Monitor health indicators in admin interface
- Scheduled visibility changes
- Monitor configuration templates
