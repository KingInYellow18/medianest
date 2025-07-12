'use client';

import { motion } from 'framer-motion';
import React from 'react';

import { ServiceStatus, QuickAction } from '@/types/dashboard';

import { ServiceCard } from '../ServiceCard';

interface PlexCardProps {
  service: ServiceStatus;
  onViewDetails?: (serviceId: string) => void;
  onQuickAction?: (action: QuickAction) => void;
}

export function PlexCard({ service, onViewDetails, onQuickAction }: PlexCardProps) {
  // Ensure the service is a Plex service
  if (service.name !== 'Plex') {
    return (
      <ServiceCard service={service} onViewDetails={onViewDetails} onQuickAction={onQuickAction} />
    );
  }

  return (
    <ServiceCard service={service} onViewDetails={onViewDetails} onQuickAction={onQuickAction}>
      {/* Additional Plex-specific features */}
      {service.details && (
        <motion.div
          className="mt-4 pt-4 border-t border-gray-700"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="space-y-2">
            {service.details.activeStreams !== undefined && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 flex items-center gap-2">
                  <span>🎥</span>
                  Active Streams:
                </span>
                <motion.span
                  className="text-white font-medium bg-blue-900/30 px-2 py-1 rounded"
                  key={service.details.activeStreams}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {service.details.activeStreams}
                </motion.span>
              </div>
            )}

            {service.details.version && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-2">
                  <span>📦</span>
                  Server Version:
                </span>
                <span className="text-green-400 font-mono text-xs bg-green-900/20 px-2 py-1 rounded">
                  v{service.details.version}
                </span>
              </div>
            )}

            {/* Plex-specific status indicators */}
            {service.status === 'up' && service.details.activeStreams !== undefined && (
              <motion.div
                className="mt-3 p-2 bg-green-900/20 rounded text-green-400 text-xs flex items-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <span>✅</span>
                <span>
                  {service.details.activeStreams === 0
                    ? 'Server ready for streaming'
                    : `${service.details.activeStreams} active ${service.details.activeStreams === 1 ? 'stream' : 'streams'}`}
                </span>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </ServiceCard>
  );
}
