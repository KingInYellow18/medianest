# Dashboard Layout Implementation - ✅ COMPLETED

## Overview

Create the main dashboard layout component that will serve as the central hub for the MediaNest application. This layout will display real-time service status cards and provide quick navigation to all integrated services.

**Status**: ✅ COMPLETED - All components implemented and functional

## Prerequisites

- Phase 2 external service integrations complete
- WebSocket connection to backend established
- React Query setup for data fetching
- Tailwind CSS configured

## Acceptance Criteria

1. Dashboard loads within 2 seconds
2. Service status cards display current status for all monitored services
3. Real-time status updates via WebSocket work correctly
4. Responsive design works on all device sizes (320px to 4K)
5. Loading and error states are properly handled

## Technical Requirements

### Component Structure

```typescript
// frontend/src/app/(auth)/dashboard/page.tsx
interface DashboardPageProps {
  // Server component - no props needed
}

// frontend/src/components/dashboard/DashboardLayout.tsx
interface DashboardLayoutProps {
  services: ServiceStatus[];
  children?: React.ReactNode;
}

// frontend/src/components/dashboard/ServiceCard.tsx
interface ServiceCardProps {
  service: ServiceStatus;
  onQuickAction?: () => void;
}

interface ServiceStatus {
  id: string;
  name: string;
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  lastCheckAt: Date;
  uptimePercentage: number;
  url?: string;
  features?: string[];
}
```

### WebSocket Integration

```typescript
// frontend/src/hooks/useServiceStatus.ts
export function useServiceStatus() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL);
    
    socket.on('service:status', (data: ServiceStatusUpdate) => {
      setServices(prev => 
        prev.map(service => 
          service.id === data.serviceId 
            ? { ...service, ...data.update }
            : service
        )
      );
    });
    
    return () => socket.disconnect();
  }, []);
  
  return services;
}
```

### Visual Design Requirements

1. **Service Cards**:
   - Green indicator for "up" status
   - Red indicator for "down" status
   - Yellow indicator for "degraded" status
   - Response time display (when available)
   - Uptime percentage (last 24h/7d/30d)
   - Quick action buttons based on service type

2. **Layout Grid**:
   - Desktop: 3 columns
   - Tablet: 2 columns
   - Mobile: 1 column
   - Minimum card height: 200px

3. **Dark Mode**:
   - Default dark theme matching Plex/Overseerr aesthetic
   - High contrast for status indicators
   - Smooth transitions for status changes

## Implementation Steps

1. **✅ Create Dashboard Page (App Router)** - COMPLETED
   ```bash
   frontend/src/app/(auth)/dashboard/page.tsx
   ```

2. **✅ Implement Service Status Hook** - COMPLETED
   ```bash
   frontend/src/hooks/useServiceStatus.ts
   ```

3. **✅ Create Dashboard Layout Component** - COMPLETED
   ```bash
   frontend/src/components/dashboard/DashboardLayout.tsx
   ```

4. **✅ Build Service Card Component** - COMPLETED
   ```bash
   frontend/src/components/dashboard/ServiceCard.tsx
   ```

5. **✅ Add Status Indicator Component** - COMPLETED
   ```bash
   frontend/src/components/dashboard/StatusIndicator.tsx
   ```

6. **✅ Implement Quick Actions** - COMPLETED
   ```bash
   frontend/src/components/dashboard/QuickActions.tsx
   ```

## Data Flow

1. Page loads → Fetch initial service status from API
2. WebSocket connects → Subscribe to 'service:status' events
3. Status update received → Update local state
4. State change → Re-render affected service cards
5. User clicks quick action → Navigate to service or perform action

## Testing Requirements

1. **Unit Tests**:
   - Service card renders with all status types
   - Status indicator shows correct colors
   - Quick actions trigger correct handlers

2. **Integration Tests**:
   - WebSocket updates reflect in UI
   - Service cards handle null/undefined data
   - Error states display correctly

3. **E2E Tests**:
   - Dashboard loads and displays all services
   - Real-time updates work as expected
   - Navigation from quick actions works

## Dependencies

```json
{
  "dependencies": {
    "socket.io-client": "^4.7.0",
    "@tanstack/react-query": "^5.x",
    "clsx": "^2.x",
    "date-fns": "^3.x"
  }
}
```

## Error Handling

1. **Service Unavailable**: Show last known status with timestamp
2. **WebSocket Disconnection**: Display connection status banner
3. **API Errors**: Show user-friendly error messages
4. **Timeout Handling**: 5-second timeout for initial load

## Accessibility

- ARIA labels for all status indicators
- Keyboard navigation for service cards
- Screen reader announcements for status changes
- High contrast mode support

## Performance Considerations

- Memoize service cards to prevent unnecessary re-renders
- Throttle WebSocket updates to max 1 per second
- Lazy load service details modals
- Use React.memo for static components

## Example Implementation

```typescript
// frontend/src/app/(auth)/dashboard/page.tsx
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { getServiceStatus } from '@/lib/api/services';

export default async function DashboardPage() {
  const services = await getServiceStatus();
  
  return (
    <DashboardLayout initialServices={services}>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
    </DashboardLayout>
  );
}

// frontend/src/components/dashboard/ServiceCard.tsx
export function ServiceCard({ service }: ServiceCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{service.name}</h3>
        <StatusIndicator status={service.status} />
      </div>
      
      <div className="space-y-2 text-sm text-gray-400">
        {service.responseTime && (
          <p>Response: {service.responseTime}ms</p>
        )}
        <p>Uptime: {service.uptimePercentage}%</p>
        <p>Last check: {formatDistanceToNow(service.lastCheckAt)}</p>
      </div>
      
      {service.features?.includes('disabled') && (
        <div className="mt-4 p-2 bg-yellow-900/20 rounded text-yellow-500 text-sm">
          Service temporarily unavailable
        </div>
      )}
    </div>
  );
}
```

## Related Tasks

- Phase 2: Uptime Kuma Integration (prerequisite)
- Phase 3: Service Status Details Modal
- Phase 3: Dashboard Notifications System

## Implementation Summary ✅

**Completed Components:**

1. **Dashboard Page (`frontend/src/app/(auth)/dashboard/page.tsx`)**
   - Server component using Next.js 14 App Router
   - Fetches initial service status via `getServiceStatus()`
   - Renders `DashboardLayout` with initial data

2. **useServiceStatus Hook (`frontend/src/hooks/useServiceStatus.ts`)**
   - WebSocket connection to backend with JWT authentication
   - Real-time service status updates via Socket.io
   - Fallback polling every 30 seconds
   - Graceful connection handling with reconnection

3. **DashboardLayout Component (`frontend/src/components/dashboard/DashboardLayout.tsx`)**
   - Client component with 'use client' directive
   - Responsive grid layout (3 cols desktop, 2 tablet, 1 mobile)
   - Connection status indicator
   - Service cards with real-time updates

4. **ServiceCard Component (`frontend/src/components/dashboard/ServiceCard.tsx`)**
   - Displays service status, response time, uptime percentage
   - Shows last check timestamp using date-fns
   - Disabled state for unavailable services
   - Quick actions integration

5. **StatusIndicator Component (`frontend/src/components/dashboard/StatusIndicator.tsx`)**
   - Color-coded status indicators (green/red/yellow)
   - Animated pulse effect
   - ARIA accessibility labels
   - High contrast design

6. **Service API (`frontend/src/lib/api/services.ts`)**
   - Server-side data fetching with Next.js caching
   - Error handling with fallback mock data
   - Date object conversion for timestamps

**Key Features Implemented:**
- ✅ Real-time WebSocket updates from Uptime Kuma
- ✅ Responsive design for all device sizes
- ✅ Loading and error states
- ✅ Dark theme matching Plex/Overseerr aesthetic
- ✅ TypeScript interfaces and proper typing
- ✅ Accessibility features (ARIA labels, keyboard navigation)
- ✅ Performance optimizations (memoization, caching)

**Architecture Patterns Used:**
- ✅ Next.js 14 App Router with Server/Client component separation
- ✅ Socket.io-client for WebSocket connections
- ✅ React hooks pattern for state management
- ✅ Component composition with proper prop interfaces
- ✅ Error boundaries and graceful degradation