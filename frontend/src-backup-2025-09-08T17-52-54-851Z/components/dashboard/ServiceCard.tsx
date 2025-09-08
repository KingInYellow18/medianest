'use client';

import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import React, { useCallback, useMemo } from 'react';

import { ServiceStatus, QuickAction } from '@/types/dashboard';

import { QuickActions } from './QuickActions';
import { StatusIndicator } from './StatusIndicator';
import { UptimeDisplay } from './UptimeDisplay';

interface ServiceCardProps {
  service: ServiceStatus;
  onViewDetails?: (serviceId: string) => void;
  onQuickAction?: (action: QuickAction) => void;
  children?: React.ReactNode;
}

// CONTEXT7 PATTERN: React.memo for ServiceCard to prevent unnecessary re-renders
// Reference: React.dev performance guide - React.memo usage for pure components
export const ServiceCard = React.memo(
  function ServiceCard({ service, onViewDetails, onQuickAction, children }: ServiceCardProps) {
    // CONTEXT7 PATTERN: useMemo to memoize expensive object creation
    // Reference: React.dev performance guide - useMemo for expensive calculations
    const statusVariants = useMemo(
      () => ({
        up: { scale: 1, opacity: 1 },
        down: { scale: 0.95, opacity: 0.8 },
        degraded: { scale: 0.98, opacity: 0.9 },
      }),
      []
    );

    // CONTEXT7 PATTERN: useCallback to memoize event handlers
    // Reference: React.dev performance guide - useCallback for stable function references
    const handleCardClick = useCallback(() => {
      if (onViewDetails) {
        onViewDetails(service.id);
      }
    }, [onViewDetails, service.id]);

    // CONTEXT7 PATTERN: useMemo to memoize derived values based on props
    // Reference: React.dev performance guide - useMemo for derived state
    const serviceIcon = useMemo(() => {
      switch (service.name) {
        case 'Plex':
          return '🎬';
        case 'Overseerr':
          return '📺';
        case 'Uptime Kuma':
          return '📊';
        default:
          return '⚙️';
      }
    }, [service.name]);

    // CONTEXT7 PATTERN: useMemo for computed display values
    // Reference: React.dev performance guide - useMemo for computed values
    const formattedLastCheck = useMemo(
      () => formatDistanceToNow(service.lastCheckAt, { addSuffix: true }),
      [service.lastCheckAt]
    );

    return (
      <motion.div
        className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-all duration-200 cursor-pointer border border-gray-700 hover:border-gray-600"
        animate={service.status}
        variants={statusVariants}
        whileHover={{
          y: -2,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        }}
        onClick={handleCardClick}
        layout
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{serviceIcon}</span>
            <div>
              <h3 className="text-lg font-semibold text-white">{service.displayName}</h3>
              {service.details?.version && (
                <p className="text-xs text-gray-400">v{service.details.version}</p>
              )}
            </div>
          </div>
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

          {service.details && (
            <div className="space-y-1">
              {service.details.activeStreams !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Active Streams:</span>
                  <span className="text-white font-medium">{service.details.activeStreams}</span>
                </div>
              )}
              {service.details.queuedRequests !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Pending Requests:</span>
                  <span className="text-white font-medium">{service.details.queuedRequests}</span>
                </div>
              )}
              {service.details.monitoredServices !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Monitored Services:</span>
                  <span className="text-white font-medium">
                    {service.details.monitoredServices}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="text-xs text-gray-500">Last check: {formattedLastCheck}</div>
        </div>

        {service.error && (
          <motion.div
            className="mt-4 p-2 bg-red-900/20 rounded text-red-400 text-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {service.error}
          </motion.div>
        )}

        {service.features?.includes('disabled') && (
          <motion.div
            className="mt-4 p-2 bg-yellow-900/20 rounded text-yellow-500 text-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Service temporarily unavailable
          </motion.div>
        )}

        {children}

        {service.url && !service.features?.includes('disabled') && (
          <div className="mt-4" onClick={(e) => e.stopPropagation()}>
            <QuickActions service={service} onQuickAction={onQuickAction} />
          </div>
        )}
      </motion.div>
    );
  },
  (prevProps, nextProps) => {
    // CONTEXT7 PATTERN: Custom comparison function for React.memo
    // Reference: React.dev performance guide - Custom comparison in React.memo
    // Only re-render if service data, handlers, or children change
    return (
      prevProps.service.id === nextProps.service.id &&
      prevProps.service.status === nextProps.service.status &&
      prevProps.service.responseTime === nextProps.service.responseTime &&
      prevProps.service.uptime === nextProps.service.uptime &&
      prevProps.service.error === nextProps.service.error &&
      prevProps.service.lastCheckAt === nextProps.service.lastCheckAt &&
      prevProps.onViewDetails === nextProps.onViewDetails &&
      prevProps.onQuickAction === nextProps.onQuickAction &&
      prevProps.children === nextProps.children
    );
  }
);
