'use client';

import { motion } from 'framer-motion';
import React from 'react';

import { ServiceStatus, QuickAction } from '@/types/dashboard';

import { ServiceCard } from '../ServiceCard';

interface UptimeKumaCardProps {
  service: ServiceStatus;
  onViewDetails?: (serviceId: string) => void;
  onQuickAction?: (action: QuickAction) => void;
}

export function UptimeKumaCard({ service, onViewDetails, onQuickAction }: UptimeKumaCardProps) {
  // Ensure the service is an Uptime Kuma service
  if (service.name !== 'Uptime Kuma') {
    return (
      <ServiceCard service={service} onViewDetails={onViewDetails} onQuickAction={onQuickAction} />
    );
  }

  // Calculate overall uptime average
  const overallUptime = service.uptime
    ? ((service.uptime['24h'] + service.uptime['7d'] + service.uptime['30d']) / 3).toFixed(1)
    : '0.0';

  return (
    <ServiceCard service={service} onViewDetails={onViewDetails} onQuickAction={onQuickAction}>
      {/* Additional Uptime Kuma-specific features */}
      {service.details && (
        <motion.div
          className="mt-4 pt-4 border-t border-gray-700"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="space-y-2">
            {service.details.monitoredServices !== undefined && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 flex items-center gap-2">
                  <span>🔍</span>
                  Monitored Services:
                </span>
                <motion.span
                  className="text-white font-medium bg-purple-900/30 px-2 py-1 rounded"
                  key={service.details.monitoredServices}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {service.details.monitoredServices}
                </motion.span>
              </div>
            )}

            {/* Overall uptime metric */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400 flex items-center gap-2">
                <span>📊</span>
                Overall Uptime:
              </span>
              <span
                className={`font-medium px-2 py-1 rounded text-xs ${
                  parseFloat(overallUptime) >= 99
                    ? 'text-green-400 bg-green-900/30'
                    : parseFloat(overallUptime) >= 95
                    ? 'text-yellow-400 bg-yellow-900/30'
                    : 'text-red-400 bg-red-900/30'
                }`}
              >
                {overallUptime}%
              </span>
            </div>

            {service.details.version && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-2">
                  <span>📦</span>
                  Version:
                </span>
                <span className="text-purple-400 font-mono text-xs bg-purple-900/20 px-2 py-1 rounded">
                  v{service.details.version}
                </span>
              </div>
            )}

            {/* Monitoring status indicator */}
            {service.status === 'up' && (
              <motion.div
                className="mt-3 p-2 bg-purple-900/20 rounded text-purple-400 text-xs flex items-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <span>📈</span>
                <span>
                  {service.details?.monitoredServices === 0
                    ? 'Monitoring system ready'
                    : `Actively monitoring ${service.details?.monitoredServices} ${
                        service.details?.monitoredServices === 1 ? 'service' : 'services'
                      }`}
                </span>
              </motion.div>
            )}

            {/* Alert if monitoring is down */}
            {service.status !== 'up' && (
              <motion.div
                className="mt-3 p-2 bg-red-900/20 rounded text-red-400 text-xs flex items-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <span>⚠️</span>
                <span>Monitoring system unavailable - service status may be outdated</span>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </ServiceCard>
  );
}
