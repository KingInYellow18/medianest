# Service Status Cards Implementation

## Overview

Implement individual service status cards that display real-time health information for each integrated service (Plex, Overseerr, Uptime Kuma). Cards should provide visual indicators, uptime metrics, and quick action buttons.

## Prerequisites

- Dashboard layout component created
- WebSocket connection established
- Service status data structure defined
- Tailwind CSS utility classes available

## Acceptance Criteria

1. Each service displays as a distinct card with consistent styling
2. Status indicators use correct colors (green/red/yellow)
3. Cards show response time and uptime percentage
4. Quick action buttons are contextual to service type
5. Cards gracefully handle missing or incomplete data
6. Animations for status transitions are smooth

## Technical Requirements

### Component Interfaces

```typescript
// frontend/src/types/services.ts
export interface ServiceStatus {
  id: string;
  name: 'Plex' | 'Overseerr' | 'Uptime Kuma';
  displayName: string;
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  lastCheckAt: Date;
  uptime: {
    '24h': number;
    '7d': number;
    '30d': number;
  };
  details?: {
    version?: string;
    activeStreams?: number;
    queuedRequests?: number;
    monitoredServices?: number;
  };
  error?: string;
}

// frontend/src/components/dashboard/ServiceCard.tsx
interface ServiceCardProps {
  service: ServiceStatus;
  onViewDetails: (serviceId: string) => void;
  onQuickAction: (action: QuickAction) => void;
}

interface QuickAction {
  type: 'navigate' | 'refresh' | 'configure';
  serviceId: string;
  url?: string;
}
```

### Service-Specific Features

1. **Plex Card**:
   - Show active streams count
   - Display server version
   - Quick actions: Browse Library, Server Settings

2. **Overseerr Card**:
   - Show pending requests count
   - Display available/unavailable status
   - Quick actions: View Requests, Submit Request

3. **Uptime Kuma Card**:
   - Show number of monitored services
   - Display overall uptime percentage
   - Quick actions: View Dashboard, Check Details

### Visual Specifications

```scss
// Card dimensions and spacing
.service-card {
  min-height: 200px;
  padding: 1.5rem;
  border-radius: 0.5rem;
  
  // Status indicator
  .status-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    
    &.up { background-color: #10b981; } // green-500
    &.down { background-color: #ef4444; } // red-500
    &.degraded { background-color: #f59e0b; } // yellow-500
  }
  
  // Hover state
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
}
```

## Implementation Steps

1. **Define Service Types and Interfaces** ✅ COMPLETED
   ```bash
   frontend/src/types/dashboard.ts (updated with enhanced ServiceStatus interface)
   ```

2. **Create Base Service Card Component** ✅ COMPLETED
   ```bash
   frontend/src/components/dashboard/ServiceCard.tsx
   ```

3. **Implement Status Indicator Component** ✅ COMPLETED
   ```bash
   frontend/src/components/dashboard/StatusIndicator.tsx
   ```

4. **Build Service-Specific Cards** ✅ COMPLETED
   ```bash
   frontend/src/components/dashboard/cards/PlexCard.tsx
   frontend/src/components/dashboard/cards/OverseerrCard.tsx
   frontend/src/components/dashboard/cards/UptimeKumaCard.tsx
   ```

5. **Create Quick Actions Component** ✅ COMPLETED
   ```bash
   frontend/src/components/dashboard/QuickActions.tsx
   frontend/src/components/dashboard/QuickActionButton.tsx
   ```

6. **Add Uptime Display Component** ✅ COMPLETED
   ```bash
   frontend/src/components/dashboard/UptimeDisplay.tsx
   ```

## Implementation Summary

**Status: COMPLETED** ✅

All acceptance criteria have been met:
- ✅ Each service displays as a distinct card with consistent styling
- ✅ Status indicators use correct colors (green/red/yellow) with pulse animations
- ✅ Cards show response time and uptime percentage (24h/7d/30d)
- ✅ Quick action buttons are contextual to service type
- ✅ Cards gracefully handle missing or incomplete data
- ✅ Framer Motion animations for status transitions are smooth

**Key Features Implemented:**
- Enhanced ServiceCard with framer-motion animations and status variants
- Service-specific cards (PlexCard, OverseerrCard, UptimeKumaCard) with unique features
- StatusIndicator with pulse effects for active services
- UptimeDisplay showing 24h/7d/30d metrics with color coding
- QuickActions with service-specific action types (navigate/configure/refresh)
- QuickActionButton component for individual action buttons
- Comprehensive error handling and loading states

**Dependencies Added:**
- framer-motion@^12.23.3 for smooth animations

## Component Examples

### Base Service Card

```typescript
// frontend/src/components/dashboard/ServiceCard.tsx
import { motion } from 'framer-motion';
import { StatusIndicator } from './StatusIndicator';
import { QuickActionButton } from './QuickActionButton';
import { UptimeDisplay } from './UptimeDisplay';

export function ServiceCard({ service, onViewDetails, onQuickAction }: ServiceCardProps) {
  const statusVariants = {
    up: { scale: 1, opacity: 1 },
    down: { scale: 0.95, opacity: 0.8 },
    degraded: { scale: 0.98, opacity: 0.9 }
  };

  return (
    <motion.div
      className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-all duration-200 cursor-pointer"
      animate={service.status}
      variants={statusVariants}
      onClick={() => onViewDetails(service.id)}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{service.displayName}</h3>
        <StatusIndicator status={service.status} pulse={service.status === 'up'} />
      </div>
      
      <div className="space-y-3">
        {service.responseTime !== undefined && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Response Time:</span>
            <span className="text-white font-medium">{service.responseTime}ms</span>
          </div>
        )}
        
        <UptimeDisplay uptime={service.uptime} />
        
        {service.error && (
          <div className="mt-3 p-2 bg-red-900/20 rounded text-red-400 text-sm">
            {service.error}
          </div>
        )}
      </div>
      
      <div className="mt-4 flex gap-2">
        {getQuickActions(service).map((action) => (
          <QuickActionButton
            key={action.type}
            action={action}
            onClick={(e) => {
              e.stopPropagation();
              onQuickAction(action);
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
```

### Status Indicator

```typescript
// frontend/src/components/dashboard/StatusIndicator.tsx
import clsx from 'clsx';

interface StatusIndicatorProps {
  status: 'up' | 'down' | 'degraded';
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusIndicator({ status, pulse = false, size = 'md' }: StatusIndicatorProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  const statusClasses = {
    up: 'bg-green-500',
    down: 'bg-red-500',
    degraded: 'bg-yellow-500'
  };

  return (
    <div className="relative">
      <div
        className={clsx(
          'rounded-full',
          sizeClasses[size],
          statusClasses[status],
          {
            'animate-pulse': pulse && status === 'up'
          }
        )}
      />
      {pulse && status === 'up' && (
        <div
          className={clsx(
            'absolute inset-0 rounded-full animate-ping',
            statusClasses[status],
            'opacity-75'
          )}
        />
      )}
    </div>
  );
}
```

### Service-Specific Card Example (Plex)

```typescript
// frontend/src/components/dashboard/cards/PlexCard.tsx
import { ServiceCard } from '../ServiceCard';
import { PlexIcon } from '@/components/icons';

export function PlexCard({ service, ...props }) {
  const enhancedService = {
    ...service,
    displayName: (
      <div className="flex items-center gap-2">
        <PlexIcon className="w-5 h-5" />
        <span>Plex Media Server</span>
      </div>
    )
  };

  return (
    <ServiceCard service={enhancedService} {...props}>
      {service.details?.activeStreams !== undefined && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Active Streams:</span>
            <span className="text-white font-medium">{service.details.activeStreams}</span>
          </div>
        </div>
      )}
    </ServiceCard>
  );
}
```

## State Management

```typescript
// frontend/src/hooks/useServiceStatus.ts
export function useServiceStatus() {
  const queryClient = useQueryClient();
  
  // Initial fetch
  const { data: services, isLoading } = useQuery({
    queryKey: ['services', 'status'],
    queryFn: fetchServiceStatus,
    refetchInterval: 60000 // Refresh every minute
  });
  
  // WebSocket updates
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL);
    
    socket.on('service:status', (update: ServiceStatusUpdate) => {
      queryClient.setQueryData(['services', 'status'], (old: ServiceStatus[]) =>
        old.map(service =>
          service.id === update.serviceId
            ? { ...service, ...update.data, lastCheckAt: new Date() }
            : service
        )
      );
    });
    
    return () => socket.disconnect();
  }, [queryClient]);
  
  return { services, isLoading };
}
```

## Testing Requirements

1. **Component Tests**:
   - Card renders with all required information
   - Status indicator shows correct color
   - Quick actions trigger correct callbacks
   - Error states display properly

2. **Visual Regression Tests**:
   - Cards maintain consistent appearance
   - Hover states work correctly
   - Status transitions are smooth

3. **Accessibility Tests**:
   - Keyboard navigation works
   - Screen readers announce status changes
   - Color contrast meets WCAG standards

## Performance Optimizations

1. Use `React.memo` for cards that don't change frequently
2. Debounce rapid status updates
3. Lazy load service icons
4. Use CSS containment for card animations

## Error Handling

- Display last known good state when service is unreachable
- Show clear error messages for connection issues
- Provide retry button for failed status checks
- Log errors to monitoring service

## Related Tasks

- Dashboard Layout Implementation
- Real-time Status Updates
- Service Details Modal
- Quick Action Handlers