import React, { memo, useMemo, useCallback } from 'react';

import type { OptimizedProps, RenderMetadata } from '../../src/types/context7-optimizations';

// Context7 Pattern - Branded types for service data
type ServiceId = string & { readonly __brand: 'ServiceId' };
type ServiceStatus = 'active' | 'inactive' | 'error' | 'maintenance';

// Context7 Pattern - Service interface with Context7 optimization metadata
interface Service {
  readonly id: ServiceId;
  readonly name: string;
  readonly status: ServiceStatus;
  readonly lastChecked: Date;
  readonly uptime: number;
  readonly responseTime?: number;
  readonly errorCount: number;
}

// Context7 Pattern - Component props with optimization hints
interface ServiceCardProps
  extends OptimizedProps<{
    service: Service;
    onStatusChange?: (serviceId: ServiceId, status: ServiceStatus) => void;
    onRetry?: (serviceId: ServiceId) => void;
    showDetails?: boolean;
    className?: string;
  }> {}

// Context7 Pattern - Status color mapping with const assertion
const STATUS_COLORS = {
  active: '#10B981', // green
  inactive: '#6B7280', // gray
  error: '#EF4444', // red
  maintenance: '#F59E0B', // amber
} as const;

// Context7 Pattern - Status badge component with React.memo
const StatusBadge = memo(
  ({ status, className = '' }: { status: ServiceStatus; className?: string }) => {
    // Context7 Pattern - Memoized style calculation
    const badgeStyle = useMemo(
      () => ({
        backgroundColor: STATUS_COLORS[status],
        color: 'white',
        padding: '0.25rem 0.5rem',
        borderRadius: '0.375rem',
        fontSize: '0.75rem',
        fontWeight: '500',
        textTransform: 'uppercase' as const,
      }),
      [status],
    );

    return (
      <span style={badgeStyle} className={className} aria-label={`Service status: ${status}`}>
        {status}
      </span>
    );
  },
);

StatusBadge.displayName = 'ServiceCard.StatusBadge';

// Context7 Pattern - Service metrics component with React.memo
const ServiceMetrics = memo(
  ({
    uptime,
    responseTime,
    errorCount,
    lastChecked,
  }: Pick<Service, 'uptime' | 'responseTime' | 'errorCount' | 'lastChecked'>) => {
    // Context7 Pattern - Memoized uptime percentage
    const uptimePercentage = useMemo(() => Math.round(uptime * 100 * 100) / 100, [uptime]);

    // Context7 Pattern - Memoized last checked time
    const lastCheckedText = useMemo(() => {
      const now = new Date();
      const diffMs = now.getTime() - lastChecked.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return `${Math.floor(diffMins / 1440)}d ago`;
    }, [lastChecked]);

    return (
      <div className='service-metrics' role='group' aria-label='Service metrics'>
        <div className='metric'>
          <span className='metric-label'>Uptime:</span>
          <span className='metric-value' data-testid='uptime'>
            {uptimePercentage}%
          </span>
        </div>

        {responseTime && (
          <div className='metric'>
            <span className='metric-label'>Response:</span>
            <span className='metric-value' data-testid='response-time'>
              {responseTime}ms
            </span>
          </div>
        )}

        <div className='metric'>
          <span className='metric-label'>Errors:</span>
          <span
            className='metric-value'
            data-testid='error-count'
            aria-label={`${errorCount} errors recorded`}
          >
            {errorCount}
          </span>
        </div>

        <div className='metric'>
          <span className='metric-label'>Last checked:</span>
          <span className='metric-value' data-testid='last-checked'>
            {lastCheckedText}
          </span>
        </div>
      </div>
    );
  },
);

ServiceMetrics.displayName = 'ServiceCard.ServiceMetrics';

// Context7 Pattern - Action buttons component with React.memo
const ServiceActions = memo(
  ({
    serviceId,
    status,
    onStatusChange,
    onRetry,
  }: {
    serviceId: ServiceId;
    status: ServiceStatus;
    onStatusChange?: (serviceId: ServiceId, status: ServiceStatus) => void;
    onRetry?: (serviceId: ServiceId) => void;
  }) => {
    // Context7 Pattern - Memoized action handlers
    const handleToggleStatus = useCallback(() => {
      if (!onStatusChange) return;

      const newStatus: ServiceStatus = status === 'active' ? 'inactive' : 'active';
      onStatusChange(serviceId, newStatus);
    }, [serviceId, status, onStatusChange]);

    const handleRetry = useCallback(() => {
      if (!onRetry) return;
      onRetry(serviceId);
    }, [serviceId, onRetry]);

    return (
      <div className='service-actions' role='group' aria-label='Service actions'>
        <button
          onClick={handleToggleStatus}
          disabled={!onStatusChange}
          className='action-btn toggle-btn'
          aria-label={`${status === 'active' ? 'Deactivate' : 'Activate'} service`}
          data-testid='toggle-status-btn'
        >
          {status === 'active' ? 'Deactivate' : 'Activate'}
        </button>

        {status === 'error' && onRetry && (
          <button
            onClick={handleRetry}
            className='action-btn retry-btn'
            aria-label='Retry service connection'
            data-testid='retry-btn'
          >
            Retry
          </button>
        )}
      </div>
    );
  },
);

ServiceActions.displayName = 'ServiceCard.ServiceActions';

// Context7 Pattern - Main service card component with comprehensive optimization
const ServiceCard = memo<ServiceCardProps>(
  ({
    service,
    onStatusChange,
    onRetry,
    showDetails = false,
    className = '',
    __optimization = {},
  }) => {
    // Context7 Pattern - Memoized CSS classes
    const cardClasses = useMemo(() => {
      const baseClasses = 'service-card';
      const statusClass = `status-${service.status}`;
      const priorityClass = __optimization.priority ? `priority-${__optimization.priority}` : '';

      return [baseClasses, statusClass, priorityClass, className].filter(Boolean).join(' ');
    }, [service.status, __optimization.priority, className]);

    // Context7 Pattern - Memoized accessibility attributes
    const accessibilityProps = useMemo(
      () => ({
        role: 'article',
        'aria-labelledby': `service-name-${service.id}`,
        'aria-describedby': `service-status-${service.id}`,
        tabIndex: 0,
      }),
      [service.id],
    );

    // Context7 Pattern - Performance tracking (development only)
    const renderMetadata = useMemo(
      (): RenderMetadata => ({
        componentName: 'ServiceCard',
        renderCount: 1, // Would be incremented in real implementation
        lastRenderTime: new Date(),
        averageRenderTime: 0, // Would be calculated in real implementation
      }),
      [],
    );

    if (process.env.NODE_ENV === 'development') {
      console.debug('ServiceCard render:', {
        serviceId: service.id,
        status: service.status,
        metadata: renderMetadata,
      });
    }

    return (
      <div
        className={cardClasses}
        {...accessibilityProps}
        data-testid={`service-card-${service.id}`}
      >
        <div className='card-header'>
          <h3 id={`service-name-${service.id}`} className='service-name'>
            {service.name}
          </h3>

          <StatusBadge status={service.status} className='status-badge' />
        </div>

        <div id={`service-status-${service.id}`} className='card-body'>
          {/* Context7 Pattern - Conditional rendering with type safety */}
          {showDetails && (
            <ServiceMetrics
              uptime={service.uptime}
              responseTime={service.responseTime}
              errorCount={service.errorCount}
              lastChecked={service.lastChecked}
            />
          )}

          <ServiceActions
            serviceId={service.id}
            status={service.status}
            onStatusChange={onStatusChange}
            onRetry={onRetry}
          />
        </div>
      </div>
    );
  },
);

ServiceCard.displayName = 'ServiceCard';

// Context7 Pattern - HOC for enhanced service card with lazy loading
export const withLazyServiceCard = <P extends object>(
  Component: React.ComponentType<P & ServiceCardProps>,
) => {
  const LazyServiceCard = memo(
    (
      props: P &
        ServiceCardProps & {
          loading?: boolean;
        },
    ) => {
      // Context7 Pattern - Loading state with skeleton
      if (props.loading) {
        return (
          <div
            className='service-card skeleton'
            aria-label='Loading service information'
            data-testid='service-card-skeleton'
          >
            <div className='skeleton-header'>
              <div className='skeleton-title' />
              <div className='skeleton-badge' />
            </div>
            <div className='skeleton-body'>
              <div className='skeleton-metrics' />
              <div className='skeleton-actions' />
            </div>
          </div>
        );
      }

      return <Component {...props} />;
    },
  );

  LazyServiceCard.displayName = `withLazyServiceCard(${Component.displayName || Component.name})`;

  return LazyServiceCard;
};

export default ServiceCard;
