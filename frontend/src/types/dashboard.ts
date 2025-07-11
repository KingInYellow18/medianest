export interface ServiceStatus {
  id: string;
  name: 'Plex' | 'Overseerr' | 'Uptime Kuma';
  displayName: string;
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  lastCheckAt: Date;
  uptime: {
    '24h': number;
    '7d': number;
    '30d': number;
  };
  details?: {
    version?: string;
    activeStreams?: number;
    queuedRequests?: number;
    monitoredServices?: number;
  };
  url?: string;
  features?: string[];
  error?: string;
}

export interface ServiceStatusUpdate {
  serviceId: string;
  update: Partial<ServiceStatus>;
}

export interface QuickAction {
  type: 'navigate' | 'refresh' | 'configure';
  serviceId: string;
  url?: string;
}