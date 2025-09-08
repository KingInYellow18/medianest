'use client';

import { useEffect, useState } from 'react';

interface PerformanceMetrics {
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({});
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  useEffect(() => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;

      const updateMetrics = () => {
        setMetrics({
          connectionType: connection.type,
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData,
        });

        // Detect slow connections
        setIsSlowConnection(
          connection.effectiveType === 'slow-2g' ||
            connection.effectiveType === '2g' ||
            connection.saveData === true
        );
      };

      updateMetrics();
      connection.addEventListener('change', updateMetrics);

      return () => {
        connection.removeEventListener('change', updateMetrics);
      };
    }
  }, []);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-3 rounded-lg max-w-xs">
      <div className="font-semibold mb-2">Performance Monitor</div>
      {metrics.effectiveType && <div>Connection: {metrics.effectiveType}</div>}
      {metrics.downlink !== undefined && <div>Downlink: {metrics.downlink.toFixed(2)} Mbps</div>}
      {metrics.rtt !== undefined && <div>RTT: {metrics.rtt}ms</div>}
      {metrics.saveData !== undefined && <div>Data Saver: {metrics.saveData ? 'On' : 'Off'}</div>}
      {isSlowConnection && <div className="mt-2 text-yellow-400">⚠️ Slow connection detected</div>}
    </div>
  );
}

// Hook to use connection info in components
export function useConnectionQuality() {
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [saveData, setSaveData] = useState(false);

  useEffect(() => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;

      const updateConnectionInfo = () => {
        setIsSlowConnection(
          connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g'
        );
        setSaveData(connection.saveData === true);
      };

      updateConnectionInfo();
      connection.addEventListener('change', updateConnectionInfo);

      return () => {
        connection.removeEventListener('change', updateConnectionInfo);
      };
    }
  }, []);

  return { isSlowConnection, saveData };
}
