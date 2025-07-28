import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, XCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ServiceHealthProps {
  serviceName: string;
  endpoint?: string;
  className?: string;
  showDetails?: boolean;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'checking';
  message?: string;
  responseTime?: number;
  lastChecked?: Date;
}

export function ServiceHealth({
  serviceName,
  endpoint = '/api/health',
  className,
  showDetails = false,
}: ServiceHealthProps) {
  const [health, setHealth] = useState<HealthStatus>({
    status: 'checking',
  });

  const checkHealth = async () => {
    setHealth((prev) => ({ ...prev, status: 'checking' }));

    try {
      const start = Date.now();
      const response = await fetch(endpoint);
      const responseTime = Date.now() - start;

      if (response.ok) {
        const data = await response.json();
        setHealth({
          status: data.status === 'ok' || data.status === 'healthy' ? 'healthy' : 'degraded',
          message: data.message,
          responseTime,
          lastChecked: new Date(),
        });
      } else {
        setHealth({
          status: 'unhealthy',
          message: `HTTP ${response.status}`,
          responseTime,
          lastChecked: new Date(),
        });
      }
    } catch (error) {
      setHealth({
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Connection failed',
        lastChecked: new Date(),
      });
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [endpoint]);

  const getStatusIcon = () => {
    switch (health.status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'checking':
        return <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />;
    }
  };

  const getStatusText = () => {
    switch (health.status) {
      case 'healthy':
        return 'Operational';
      case 'degraded':
        return 'Degraded';
      case 'unhealthy':
        return 'Down';
      case 'checking':
        return 'Checking...';
    }
  };

  const getStatusColor = () => {
    switch (health.status) {
      case 'healthy':
        return 'text-green-600 bg-green-50';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50';
      case 'unhealthy':
        return 'text-red-600 bg-red-50';
      case 'checking':
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      {getStatusIcon()}
      <span className="font-medium">{serviceName}</span>
      <span className={cn('px-2 py-1 rounded-full text-xs', getStatusColor())}>
        {getStatusText()}
      </span>
      {showDetails && health.responseTime && (
        <span className="text-xs text-muted-foreground">{health.responseTime}ms</span>
      )}
    </div>
  );
}

interface ServiceHealthListProps {
  services: Array<{
    name: string;
    endpoint?: string;
  }>;
  className?: string;
}

export function ServiceHealthList({ services, className }: ServiceHealthListProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {services.map((service) => (
        <ServiceHealth
          key={service.name}
          serviceName={service.name}
          endpoint={service.endpoint}
          showDetails
        />
      ))}
    </div>
  );
}

export function HealthStatusBadge({ className }: { className?: string }) {
  const [overallHealth, setOverallHealth] = useState<'healthy' | 'degraded' | 'unhealthy'>(
    'healthy',
  );

  useEffect(() => {
    const checkOverallHealth = async () => {
      try {
        const response = await fetch('/api/health/details');
        if (response.ok) {
          const data = await response.json();
          setOverallHealth(data.status);
        } else {
          setOverallHealth('unhealthy');
        }
      } catch {
        setOverallHealth('unhealthy');
      }
    };

    checkOverallHealth();
    const interval = setInterval(checkOverallHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getBadgeStyle = () => {
    switch (overallHealth) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'unhealthy':
        return 'bg-red-100 text-red-800 border-red-300';
    }
  };

  const getBadgeText = () => {
    switch (overallHealth) {
      case 'healthy':
        return 'All Systems Operational';
      case 'degraded':
        return 'Partial Outage';
      case 'unhealthy':
        return 'Major Outage';
    }
  };

  return (
    <div
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border',
        getBadgeStyle(),
        className,
      )}
    >
      <div
        className={cn(
          'w-2 h-2 rounded-full mr-2',
          overallHealth === 'healthy' && 'bg-green-500',
          overallHealth === 'degraded' && 'bg-yellow-500',
          overallHealth === 'unhealthy' && 'bg-red-500',
        )}
      />
      {getBadgeText()}
    </div>
  );
}
