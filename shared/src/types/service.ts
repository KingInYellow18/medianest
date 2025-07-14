// Service-related types

export type ServiceName = 'Plex' | 'Overseerr' | 'Uptime Kuma';

export interface UptimeMetrics {
  '24h': number;
  '7d': number;
  '30d': number;
}

export interface ServiceDetails {
  version?: string;
  activeStreams?: number;
  queuedRequests?: number;
  monitoredServices?: number;
}

export interface ServiceStatus {
  id: string;
  name: ServiceName;
  displayName: string;
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  lastCheckAt: Date;
  uptime: UptimeMetrics;
  details?: ServiceDetails;
  url?: string;
  features?: string[];
  error?: string;
}

export interface ServiceStatusUpdate {
  serviceId: string;
  update: Partial<ServiceStatus>;
}

export interface ServiceConfiguration {
  id: string;
  name: ServiceName;
  url: string;
  apiKey?: string;
  enabled: boolean;
  checkInterval?: number; // in milliseconds
  timeout?: number; // in milliseconds
}
