'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';

interface BackendStatus {
  status: string;
  timestamp?: string;
  message?: string;
  error?: string;
}

interface ApiConnectionStatusProps {
  className?: string;
}

export const ApiConnectionStatus: React.FC<ApiConnectionStatusProps> = ({ className = '' }) => {
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<string>('');

  const checkBackendStatus = async () => {
    setIsLoading(true);
    try {
      // Test both health endpoints
      const [healthResponse, apiHealthResponse] = await Promise.allSettled([
        fetch('http://localhost:4000/health'),
        fetch('http://localhost:4000/api/v1/health'),
      ]);

      let status: BackendStatus = {
        status: 'error',
        error: 'Unknown error occurred',
      };

      if (healthResponse.status === 'fulfilled' && healthResponse.value.ok) {
        const healthData = await healthResponse.value.json();
        status = {
          status: 'healthy',
          timestamp: healthData.timestamp,
          message: 'Backend is running successfully',
        };
      } else if (apiHealthResponse.status === 'fulfilled' && apiHealthResponse.value.ok) {
        const apiHealthData = await apiHealthResponse.value.json();
        status = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          message: `API Status: ${apiHealthData.message || apiHealthData.status}`,
        };
      } else {
        status = {
          status: 'error',
          error: 'Backend server is not responding',
        };
      }

      setBackendStatus(status);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Backend health check failed:', error);
      setBackendStatus({
        status: 'error',
        error: error instanceof Error ? error.message : 'Connection failed',
      });
      setLastChecked(new Date().toLocaleTimeString());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkBackendStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkBackendStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = () => {
    if (isLoading) {
      return <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />;
    }

    switch (backendStatus?.status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusColor = () => {
    switch (backendStatus?.status) {
      case 'healthy':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'error':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    }
  };

  return (
    <div className={`rounded-lg border p-4 ${getStatusColor()} ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <h3 className="font-semibold">Backend Connection</h3>
            <p className="text-sm opacity-90">
              {backendStatus?.message || backendStatus?.error || 'Checking...'}
            </p>
          </div>
        </div>
        <button
          onClick={checkBackendStatus}
          disabled={isLoading}
          className="rounded px-3 py-1 text-xs font-medium opacity-80 hover:opacity-100 disabled:opacity-50"
        >
          {isLoading ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      {lastChecked && <div className="mt-2 text-xs opacity-70">Last checked: {lastChecked}</div>}

      {backendStatus?.timestamp && (
        <div className="mt-1 text-xs opacity-70">
          Server time: {new Date(backendStatus.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
};
