'use client';

import React from 'react';

interface UptimeDisplayProps {
  uptime: {
    '24h': number;
    '7d': number;
    '30d': number;
  };
}

export function UptimeDisplay({ uptime }: UptimeDisplayProps) {
  const formatUptime = (value: number) => {
    return value.toFixed(1);
  };

  const getUptimeColor = (value: number) => {
    if (value >= 99) return 'text-green-400';
    if (value >= 95) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">24h:</span>
        <span className={getUptimeColor(uptime['24h'])}>{formatUptime(uptime['24h'])}%</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">7d:</span>
        <span className={getUptimeColor(uptime['7d'])}>{formatUptime(uptime['7d'])}%</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">30d:</span>
        <span className={getUptimeColor(uptime['30d'])}>{formatUptime(uptime['30d'])}%</span>
      </div>
    </div>
  );
}
