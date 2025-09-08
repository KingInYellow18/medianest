'use client';

import { motion } from 'framer-motion';
import React from 'react';

import { ServiceStatus, QuickAction } from '@/types/dashboard';

import { ServiceCard } from '../ServiceCard';

interface OverseerrCardProps {
  service: ServiceStatus;
  onViewDetails?: (serviceId: string) => void;
  onQuickAction?: (action: QuickAction) => void;
}

export function OverseerrCard({ service, onViewDetails, onQuickAction }: OverseerrCardProps) {
  // Ensure the service is an Overseerr service
  if (service.name !== 'Overseerr') {
    return (
      <ServiceCard service={service} onViewDetails={onViewDetails} onQuickAction={onQuickAction} />
    );
  }

  return (
    <ServiceCard service={service} onViewDetails={onViewDetails} onQuickAction={onQuickAction}>
      {/* Additional Overseerr-specific features */}
      {service.details && (
        <motion.div
          className="mt-4 pt-4 border-t border-gray-700"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="space-y-2">
            {service.details.queuedRequests !== undefined && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 flex items-center gap-2">
                  <span>📋</span>
                  Pending Requests:
                </span>
                <motion.span
                  className={`font-medium px-2 py-1 rounded ${
                    service.details.queuedRequests > 0
                      ? 'text-yellow-400 bg-yellow-900/30'
                      : 'text-green-400 bg-green-900/30'
                  }`}
                  key={service.details.queuedRequests}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {service.details.queuedRequests}
                </motion.span>
              </div>
            )}

            {service.details.version && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-2">
                  <span>📦</span>
                  Version:
                </span>
                <span className="text-blue-400 font-mono text-xs bg-blue-900/20 px-2 py-1 rounded">
                  v{service.details.version}
                </span>
              </div>
            )}

            {/* Overseerr availability status */}
            <div className="flex justify-between text-sm">
              <span className="text-gray-400 flex items-center gap-2">
                <span>🎭</span>
                Request Status:
              </span>
              <span
                className={`text-xs px-2 py-1 rounded font-medium ${
                  service.status === 'up'
                    ? 'text-green-400 bg-green-900/20'
                    : 'text-red-400 bg-red-900/20'
                }`}
              >
                {service.status === 'up' ? 'Accepting Requests' : 'Unavailable'}
              </span>
            </div>

            {/* Overseerr-specific status indicators */}
            {service.status === 'up' && (
              <motion.div
                className="mt-3 p-2 bg-blue-900/20 rounded text-blue-400 text-xs flex items-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <span>📺</span>
                <span>
                  {service.details?.queuedRequests === 0
                    ? 'Ready to process new media requests'
                    : `Processing ${service.details?.queuedRequests} pending ${
                        service.details?.queuedRequests === 1 ? 'request' : 'requests'
                      }`}
                </span>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </ServiceCard>
  );
}
