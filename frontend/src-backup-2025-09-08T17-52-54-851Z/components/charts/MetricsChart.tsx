'use client';

import React from 'react';

export interface MetricsChartProps {
  data?: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
  title?: string;
  type?: 'bar' | 'line' | 'pie';
  className?: string;
}

export function MetricsChart({
  data = [],
  title = 'Metrics Chart',
  type = 'bar',
  className = '',
}: MetricsChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>

      {data.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">No data available</div>
      ) : (
        <div className="space-y-4">
          {data.map((item, index) => (
            <div key={index} className="flex items-center space-x-4">
              <div className="w-20 text-sm text-gray-600 dark:text-gray-300 truncate">
                {item.label}
              </div>
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4 relative">
                <div
                  className={`h-full rounded-full ${
                    item.color || 'bg-blue-500'
                  } transition-all duration-300`}
                  style={{
                    width: `${(item.value / maxValue) * 100}%`,
                  }}
                />
              </div>
              <div className="w-12 text-sm font-medium text-gray-900 dark:text-white text-right">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
