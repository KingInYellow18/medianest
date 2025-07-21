'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  HardDrive,
  Cpu,
  Server,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Button } from '@/components/ui/button';

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  message?: string;
  details?: Record<string, any>;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: HealthCheck[];
  system?: {
    cpu: {
      usage: number;
      count: number;
      loadAvg: number[];
    };
    memory: {
      total: string;
      free: string;
      used: string;
      percentage: number;
    };
    disk: {
      total: string;
      free: string;
      used: string;
      percentage: number;
    };
  };
}

export default function StatusPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { socket, connected } = useWebSocket();

  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/health/details');
      if (!response.ok) {
        throw new Error('Failed to fetch health status');
      }
      const data = await response.json();
      setHealth(data);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health status');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    if (socket?.connected) {
      socket.emit('health:refresh');
    } else {
      await fetchHealth();
    }
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [socket]);

  useEffect(() => {
    fetchHealth();

    if (socket) {
      // Subscribe to health updates
      socket.emit('subscribe:health');

      // Listen for health updates
      socket.on('health:current', (data: SystemHealth) => {
        setHealth(data);
        setLastUpdate(new Date());
        setLoading(false);
      });

      socket.on('health:updated', (data: SystemHealth) => {
        setHealth(data);
        setLastUpdate(new Date());
      });

      socket.on('health:detailed', (data: SystemHealth) => {
        setHealth(data);
        setLastUpdate(new Date());
      });

      return () => {
        socket.emit('unsubscribe:health');
        socket.off('health:current');
        socket.off('health:updated');
        socket.off('health:detailed');
      };
    } else {
      // Fallback to polling if WebSocket is not available
      const interval = setInterval(fetchHealth, 30000);
      return () => clearInterval(interval);
    }
  }, [socket]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-500 text-white">Operational</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500 text-white">Degraded</Badge>;
      case 'unhealthy':
        return <Badge className="bg-red-500 text-white">Down</Badge>;
      default:
        return null;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.join(' ') || '0m';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-6">
          <div className="flex items-center space-x-2 text-red-500">
            <XCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">System Status</h1>
          <p className="text-muted-foreground">
            Real-time health monitoring
            {connected && (
              <span className="ml-2 text-green-600 text-sm">
                <Activity className="inline h-3 w-3 mr-1" />
                Live
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Last updated</p>
            <p className="text-sm font-medium">{format(lastUpdate, 'HH:mm:ss')}</p>
          </div>
        </div>
      </div>

      {/* Overall Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {getStatusIcon(health?.status || 'unknown')}
            <div>
              <h2 className="text-xl font-semibold">System Status</h2>
              <p className="text-muted-foreground">
                {health?.status === 'healthy' && 'All systems operational'}
                {health?.status === 'degraded' && 'Some services are experiencing issues'}
                {health?.status === 'unhealthy' && 'Major service disruption'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {getStatusBadge(health?.status || 'unknown')}
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Uptime</p>
              <p className="text-sm font-medium">{formatUptime(health?.uptime || 0)}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Service Health Checks */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Service Health</h3>
        <div className="space-y-3">
          {health?.checks.map((check) => (
            <div
              key={check.service}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center space-x-3">
                {getStatusIcon(check.status)}
                <div>
                  <p className="font-medium capitalize">{check.service.replace('_', ' ')}</p>
                  {check.message && (
                    <p className="text-sm text-muted-foreground">{check.message}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {check.responseTime && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Response Time</p>
                    <p className="text-sm font-medium">{check.responseTime.toFixed(0)}ms</p>
                  </div>
                )}
                {getStatusBadge(check.status)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* System Resources (if available) */}
      {health?.system && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* CPU Usage */}
          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Cpu className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">CPU Usage</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Load Average</span>
                <span className="font-medium">{health.system.cpu.loadAvg[0].toFixed(2)}</span>
              </div>
              <div className="text-xs text-muted-foreground">{health.system.cpu.count} cores</div>
            </div>
          </Card>

          {/* Memory Usage */}
          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Server className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Memory Usage</h3>
            </div>
            <div className="space-y-2">
              <Progress value={health.system.memory.percentage} className="h-2" />
              <div className="flex justify-between text-sm">
                <span>{health.system.memory.used}</span>
                <span>{health.system.memory.total}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {health.system.memory.percentage.toFixed(1)}% used
              </div>
            </div>
          </Card>

          {/* Disk Usage */}
          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <HardDrive className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Disk Usage</h3>
            </div>
            <div className="space-y-2">
              <Progress value={health.system.disk.percentage} className="h-2" />
              <div className="flex justify-between text-sm">
                <span>{health.system.disk.used}</span>
                <span>{health.system.disk.total}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {health.system.disk.percentage.toFixed(1)}% used
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Service Details */}
      {health?.checks.some((c) => c.details) && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Service Details</h3>
          <div className="space-y-4">
            {health.checks
              .filter((c) => c.details)
              .map((check) => (
                <div key={check.service} className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2 capitalize">{check.service.replace('_', ' ')}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(check.details || {}).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground capitalize">
                          {key.replace('_', ' ')}:
                        </span>
                        <span className="font-medium">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          Version {health?.version} | Environment: {process.env.NODE_ENV}
        </p>
      </div>
    </div>
  );
}
